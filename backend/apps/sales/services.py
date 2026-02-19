from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from apps.accounting.services import get_next_sequence_value
from apps.journals.models import JournalStatus
from apps.journals.services import post_journal_entry, replace_journal_lines, void_journal_entry
from apps.sales.models import Invoice, InvoiceLine, InvoiceStatus, Receipt, ReceiptAllocation, ReceiptStatus


class SalesValidationError(ValueError):
    pass


def _invoice_open_amount(invoice: Invoice) -> Decimal:
    return (invoice.total or Decimal("0")) - (invoice.amount_paid or Decimal("0"))


@transaction.atomic
def replace_invoice_lines(*, invoice: Invoice, lines: list[dict]):
    if invoice.status != InvoiceStatus.DRAFT:
        raise SalesValidationError("Only draft invoices can be edited.")
    if not lines:
        raise SalesValidationError("At least one invoice line is required.")

    invoice.lines.all().delete()
    created_lines = []
    subtotal = Decimal("0")

    for line in lines:
        quantity = line["quantity"]
        unit_price = line["unit_price"]
        line_total = (quantity * unit_price).quantize(Decimal("0.0001"))
        subtotal += line_total
        created_lines.append(
            InvoiceLine(
                company=invoice.company,
                invoice=invoice,
                line_no=line["line_no"],
                description=line["description"],
                quantity=quantity,
                unit_price=unit_price,
                line_total=line_total,
                revenue_account=line["revenue_account"],
            )
        )

    InvoiceLine.objects.bulk_create(created_lines)
    invoice.subtotal = subtotal
    invoice.tax_total = Decimal("0")
    invoice.total = subtotal
    invoice.save(update_fields=["subtotal", "tax_total", "total", "updated_at"])
    return invoice


@transaction.atomic
def post_invoice(*, invoice: Invoice, actor_user):
    invoice = Invoice.objects.select_for_update().get(id=invoice.id)
    if invoice.status != InvoiceStatus.DRAFT:
        raise SalesValidationError("Only draft invoices can be posted.")
    if not invoice.lines.exists():
        raise SalesValidationError("Invoice must have at least one line.")
    if invoice.total <= 0:
        raise SalesValidationError("Invoice total must be greater than zero.")

    if not invoice.invoice_no:
        invoice.invoice_no = get_next_sequence_value(company=invoice.company, key="invoice")

    line_payload = [
        {
            "account": invoice.ar_account,
            "debit": invoice.total,
            "credit": Decimal("0"),
            "description": "Accounts Receivable",
        }
    ]
    for inv_line in invoice.lines.select_related("revenue_account").all().order_by("line_no"):
        line_payload.append(
            {
                "account": inv_line.revenue_account,
                "debit": Decimal("0"),
                "credit": inv_line.line_total,
                "description": f"Revenue: {inv_line.description}",
            }
        )

    if invoice.journal_entry_id:
        journal_entry = invoice.journal_entry
    else:
        from apps.journals.models import JournalEntry  # local import to avoid cyc dependency at import time

        journal_entry = JournalEntry.objects.create(
            company=invoice.company,
            status=JournalStatus.DRAFT,
            entry_date=invoice.issue_date,
            description=f"Invoice {invoice.invoice_no or invoice.id}",
            reference_type="invoice",
            reference_id=invoice.id,
        )
        invoice.journal_entry = journal_entry

    replace_journal_lines(entry=journal_entry, lines=line_payload)
    post_journal_entry(entry=journal_entry, actor_user=actor_user)

    invoice.status = InvoiceStatus.POSTED
    invoice.save(update_fields=["invoice_no", "status", "journal_entry", "updated_at"])
    return invoice


@transaction.atomic
def void_invoice(*, invoice: Invoice, actor_user):
    invoice = Invoice.objects.select_for_update().get(id=invoice.id)
    if invoice.status not in {InvoiceStatus.POSTED, InvoiceStatus.PARTIALLY_PAID}:
        raise SalesValidationError("Only posted/partially paid invoices can be voided.")
    if invoice.amount_paid > 0:
        raise SalesValidationError("Cannot void invoice with recorded payments.")
    if not invoice.journal_entry_id:
        raise SalesValidationError("Invoice has no journal entry to void.")

    void_journal_entry(entry=invoice.journal_entry, actor_user=actor_user)
    invoice.status = InvoiceStatus.VOID
    invoice.save(update_fields=["status", "updated_at"])
    return invoice


@transaction.atomic
def replace_receipt_allocations(*, receipt: Receipt, allocations: list[dict]):
    if receipt.status != ReceiptStatus.DRAFT:
        raise SalesValidationError("Only draft receipts can be edited.")
    if not allocations:
        raise SalesValidationError("At least one allocation is required.")

    total_allocation = Decimal("0")
    for item in allocations:
        invoice = item["invoice"]
        if invoice.customer_id != receipt.customer_id:
            raise SalesValidationError("Receipt allocation invoice customer mismatch.")
        open_amount = _invoice_open_amount(invoice)
        if item["amount"] <= 0:
            raise SalesValidationError("Allocation amount must be positive.")
        if item["amount"] > open_amount:
            raise SalesValidationError("Allocation exceeds invoice open balance.")
        total_allocation += item["amount"]

    if total_allocation > receipt.amount:
        raise SalesValidationError("Total allocation exceeds receipt amount.")

    receipt.allocations.all().delete()
    ReceiptAllocation.objects.bulk_create(
        [
            ReceiptAllocation(
                company=receipt.company,
                receipt=receipt,
                invoice=item["invoice"],
                amount=item["amount"],
            )
            for item in allocations
        ]
    )
    return receipt


def _refresh_invoice_payment_status(invoice: Invoice):
    if invoice.amount_paid <= 0:
        invoice.status = InvoiceStatus.POSTED
    elif invoice.amount_paid < invoice.total:
        invoice.status = InvoiceStatus.PARTIALLY_PAID
    else:
        invoice.status = InvoiceStatus.PAID
    invoice.save(update_fields=["amount_paid", "status", "updated_at"])


@transaction.atomic
def post_receipt(*, receipt: Receipt, actor_user):
    receipt = Receipt.objects.select_for_update().get(id=receipt.id)
    if receipt.status != ReceiptStatus.DRAFT:
        raise SalesValidationError("Only draft receipts can be posted.")
    allocations = list(receipt.allocations.select_related("invoice", "invoice__ar_account").all())
    if not allocations:
        raise SalesValidationError("Receipt must include at least one allocation.")

    total_allocation = Decimal("0")
    credit_by_account = {}
    account_lookup = {}
    for allocation in allocations:
        open_amount = _invoice_open_amount(allocation.invoice)
        if allocation.amount > open_amount:
            raise SalesValidationError("Allocation exceeds invoice open balance.")
        total_allocation += allocation.amount
        credit_by_account.setdefault(allocation.invoice.ar_account_id, Decimal("0"))
        credit_by_account[allocation.invoice.ar_account_id] += allocation.amount
        account_lookup[allocation.invoice.ar_account_id] = allocation.invoice.ar_account

    if total_allocation > receipt.amount:
        raise SalesValidationError("Total allocation exceeds receipt amount.")

    if not receipt.receipt_no:
        receipt.receipt_no = get_next_sequence_value(company=receipt.company, key="receipt")

    if receipt.journal_entry_id:
        journal_entry = receipt.journal_entry
    else:
        from apps.journals.models import JournalEntry

        journal_entry = JournalEntry.objects.create(
            company=receipt.company,
            status=JournalStatus.DRAFT,
            entry_date=receipt.received_date,
            description=f"Receipt {receipt.receipt_no or receipt.id}",
            reference_type="receipt",
            reference_id=receipt.id,
        )
        receipt.journal_entry = journal_entry

    lines = [
        {
            "account": receipt.deposit_account,
            "debit": total_allocation,
            "credit": Decimal("0"),
            "description": "Cash/Bank receipt",
        }
    ]
    for account_id, amount in credit_by_account.items():
        account = account_lookup[account_id]
        lines.append(
            {
                "account": account,
                "debit": Decimal("0"),
                "credit": amount,
                "description": "Accounts Receivable settlement",
            }
        )

    replace_journal_lines(entry=journal_entry, lines=lines)
    post_journal_entry(entry=journal_entry, actor_user=actor_user)

    for allocation in allocations:
        allocation.invoice.amount_paid = (allocation.invoice.amount_paid or Decimal("0")) + allocation.amount
        _refresh_invoice_payment_status(allocation.invoice)

    receipt.status = ReceiptStatus.POSTED
    receipt.save(update_fields=["receipt_no", "status", "journal_entry", "updated_at"])
    return receipt


@transaction.atomic
def void_receipt(*, receipt: Receipt, actor_user):
    receipt = Receipt.objects.select_for_update().get(id=receipt.id)
    if receipt.status != ReceiptStatus.POSTED:
        raise SalesValidationError("Only posted receipts can be voided.")
    if not receipt.journal_entry_id:
        raise SalesValidationError("Receipt has no journal entry to void.")

    void_journal_entry(entry=receipt.journal_entry, actor_user=actor_user)

    for allocation in receipt.allocations.select_related("invoice").all():
        allocation.invoice.amount_paid = (allocation.invoice.amount_paid or Decimal("0")) - allocation.amount
        if allocation.invoice.amount_paid < 0:
            allocation.invoice.amount_paid = Decimal("0")
        _refresh_invoice_payment_status(allocation.invoice)

    receipt.status = ReceiptStatus.VOID
    receipt.save(update_fields=["status", "updated_at"])
    return receipt


def build_ar_aging(*, company, as_of_date):
    rows = []
    invoices = Invoice.objects.filter(
        company=company,
        status__in=[InvoiceStatus.POSTED, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.PAID],
    ).select_related("customer")
    for invoice in invoices:
        open_amount = _invoice_open_amount(invoice)
        if open_amount <= 0:
            continue
        due_date = invoice.due_date or invoice.issue_date
        age_days = (as_of_date - due_date).days

        if age_days <= 30:
            bucket = "0-30"
        elif age_days <= 60:
            bucket = "31-60"
        elif age_days <= 90:
            bucket = "61-90"
        else:
            bucket = "90+"

        rows.append(
            {
                "invoice_id": str(invoice.id),
                "invoice_no": invoice.invoice_no,
                "customer_name": invoice.customer.name,
                "due_date": due_date,
                "open_amount": str(open_amount),
                "age_days": age_days,
                "bucket": bucket,
            }
        )
    return rows
