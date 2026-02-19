from decimal import Decimal

from django.db import transaction

from apps.accounting.services import get_next_sequence_value
from apps.journals.models import JournalStatus
from apps.journals.services import post_journal_entry, replace_journal_lines, void_journal_entry
from apps.purchases.models import Bill, BillLine, BillStatus, VendorPayment, VendorPaymentAllocation, VendorPaymentStatus


class PurchasesValidationError(ValueError):
    pass


def _bill_open_amount(bill: Bill) -> Decimal:
    return (bill.total or Decimal("0")) - (bill.amount_paid or Decimal("0"))


@transaction.atomic
def replace_bill_lines(*, bill: Bill, lines: list[dict]):
    if bill.status != BillStatus.DRAFT:
        raise PurchasesValidationError("Only draft bills can be edited.")
    if not lines:
        raise PurchasesValidationError("At least one bill line is required.")

    bill.lines.all().delete()
    created_lines = []
    subtotal = Decimal("0")

    for line in lines:
        quantity = line["quantity"]
        unit_cost = line["unit_cost"]
        line_total = (quantity * unit_cost).quantize(Decimal("0.0001"))
        subtotal += line_total
        created_lines.append(
            BillLine(
                company=bill.company,
                bill=bill,
                line_no=line["line_no"],
                description=line["description"],
                quantity=quantity,
                unit_cost=unit_cost,
                line_total=line_total,
                expense_account=line["expense_account"],
            )
        )

    BillLine.objects.bulk_create(created_lines)
    bill.subtotal = subtotal
    bill.tax_total = Decimal("0")
    bill.total = subtotal
    bill.save(update_fields=["subtotal", "tax_total", "total", "updated_at"])
    return bill


@transaction.atomic
def post_bill(*, bill: Bill, actor_user):
    bill = Bill.objects.select_for_update().get(id=bill.id)
    if bill.status != BillStatus.DRAFT:
        raise PurchasesValidationError("Only draft bills can be posted.")
    if not bill.lines.exists():
        raise PurchasesValidationError("Bill must have at least one line.")
    if bill.total <= 0:
        raise PurchasesValidationError("Bill total must be greater than zero.")

    if not bill.bill_no:
        bill.bill_no = get_next_sequence_value(company=bill.company, key="bill")

    line_payload = [
        {
            "account": bill.ap_account,
            "debit": Decimal("0"),
            "credit": bill.total,
            "description": "Accounts Payable",
        }
    ]
    for bill_line in bill.lines.select_related("expense_account").all().order_by("line_no"):
        line_payload.append(
            {
                "account": bill_line.expense_account,
                "debit": bill_line.line_total,
                "credit": Decimal("0"),
                "description": f"Expense: {bill_line.description}",
            }
        )

    if bill.journal_entry_id:
        journal_entry = bill.journal_entry
    else:
        from apps.journals.models import JournalEntry  # local import to avoid cyc dependency at import time

        journal_entry = JournalEntry.objects.create(
            company=bill.company,
            status=JournalStatus.DRAFT,
            entry_date=bill.bill_date,
            description=f"Bill {bill.bill_no or bill.id}",
            reference_type="bill",
            reference_id=bill.id,
        )
        bill.journal_entry = journal_entry

    replace_journal_lines(entry=journal_entry, lines=line_payload)
    post_journal_entry(entry=journal_entry, actor_user=actor_user)

    bill.status = BillStatus.POSTED
    bill.save(update_fields=["bill_no", "status", "journal_entry", "updated_at"])
    return bill


@transaction.atomic
def void_bill(*, bill: Bill, actor_user):
    bill = Bill.objects.select_for_update().get(id=bill.id)
    if bill.status not in {BillStatus.POSTED, BillStatus.PARTIALLY_PAID}:
        raise PurchasesValidationError("Only posted/partially paid bills can be voided.")
    if bill.amount_paid > 0:
        raise PurchasesValidationError("Cannot void bill with recorded payments.")
    if not bill.journal_entry_id:
        raise PurchasesValidationError("Bill has no journal entry to void.")

    void_journal_entry(entry=bill.journal_entry, actor_user=actor_user)
    bill.status = BillStatus.VOID
    bill.save(update_fields=["status", "updated_at"])
    return bill


@transaction.atomic
def replace_vendor_payment_allocations(*, vendor_payment: VendorPayment, allocations: list[dict]):
    if vendor_payment.status != VendorPaymentStatus.DRAFT:
        raise PurchasesValidationError("Only draft vendor payments can be edited.")
    if not allocations:
        raise PurchasesValidationError("At least one allocation is required.")

    total_allocation = Decimal("0")
    for item in allocations:
        bill = item["bill"]
        if bill.vendor_id != vendor_payment.vendor_id:
            raise PurchasesValidationError("Vendor payment allocation bill vendor mismatch.")
        open_amount = _bill_open_amount(bill)
        if item["amount"] <= 0:
            raise PurchasesValidationError("Allocation amount must be positive.")
        if item["amount"] > open_amount:
            raise PurchasesValidationError("Allocation exceeds bill open balance.")
        total_allocation += item["amount"]

    if total_allocation > vendor_payment.amount:
        raise PurchasesValidationError("Total allocation exceeds vendor payment amount.")

    vendor_payment.allocations.all().delete()
    VendorPaymentAllocation.objects.bulk_create(
        [
            VendorPaymentAllocation(
                company=vendor_payment.company,
                vendor_payment=vendor_payment,
                bill=item["bill"],
                amount=item["amount"],
            )
            for item in allocations
        ]
    )
    return vendor_payment


def _refresh_bill_payment_status(bill: Bill):
    if bill.amount_paid <= 0:
        bill.status = BillStatus.POSTED
    elif bill.amount_paid < bill.total:
        bill.status = BillStatus.PARTIALLY_PAID
    else:
        bill.status = BillStatus.PAID
    bill.save(update_fields=["amount_paid", "status", "updated_at"])


@transaction.atomic
def post_vendor_payment(*, vendor_payment: VendorPayment, actor_user):
    vendor_payment = VendorPayment.objects.select_for_update().get(id=vendor_payment.id)
    if vendor_payment.status != VendorPaymentStatus.DRAFT:
        raise PurchasesValidationError("Only draft vendor payments can be posted.")
    allocations = list(vendor_payment.allocations.select_related("bill", "bill__ap_account").all())
    if not allocations:
        raise PurchasesValidationError("Vendor payment must include at least one allocation.")

    total_allocation = Decimal("0")
    debit_by_account = {}
    account_lookup = {}
    for allocation in allocations:
        open_amount = _bill_open_amount(allocation.bill)
        if allocation.amount > open_amount:
            raise PurchasesValidationError("Allocation exceeds bill open balance.")
        total_allocation += allocation.amount
        debit_by_account.setdefault(allocation.bill.ap_account_id, Decimal("0"))
        debit_by_account[allocation.bill.ap_account_id] += allocation.amount
        account_lookup[allocation.bill.ap_account_id] = allocation.bill.ap_account

    if total_allocation > vendor_payment.amount:
        raise PurchasesValidationError("Total allocation exceeds vendor payment amount.")

    if not vendor_payment.payment_no:
        vendor_payment.payment_no = get_next_sequence_value(company=vendor_payment.company, key="vendor_payment")

    if vendor_payment.journal_entry_id:
        journal_entry = vendor_payment.journal_entry
    else:
        from apps.journals.models import JournalEntry

        journal_entry = JournalEntry.objects.create(
            company=vendor_payment.company,
            status=JournalStatus.DRAFT,
            entry_date=vendor_payment.paid_date,
            description=f"Vendor Payment {vendor_payment.payment_no or vendor_payment.id}",
            reference_type="vendor_payment",
            reference_id=vendor_payment.id,
        )
        vendor_payment.journal_entry = journal_entry

    lines = [
        {
            "account": vendor_payment.payment_account,
            "debit": Decimal("0"),
            "credit": total_allocation,
            "description": "Cash/Bank payment",
        }
    ]
    for account_id, amount in debit_by_account.items():
        account = account_lookup[account_id]
        lines.append(
            {
                "account": account,
                "debit": amount,
                "credit": Decimal("0"),
                "description": "Accounts Payable settlement",
            }
        )

    replace_journal_lines(entry=journal_entry, lines=lines)
    post_journal_entry(entry=journal_entry, actor_user=actor_user)

    for allocation in allocations:
        allocation.bill.amount_paid = (allocation.bill.amount_paid or Decimal("0")) + allocation.amount
        _refresh_bill_payment_status(allocation.bill)

    vendor_payment.status = VendorPaymentStatus.POSTED
    vendor_payment.save(update_fields=["payment_no", "status", "journal_entry", "updated_at"])
    return vendor_payment


@transaction.atomic
def void_vendor_payment(*, vendor_payment: VendorPayment, actor_user):
    vendor_payment = VendorPayment.objects.select_for_update().get(id=vendor_payment.id)
    if vendor_payment.status != VendorPaymentStatus.POSTED:
        raise PurchasesValidationError("Only posted vendor payments can be voided.")
    if not vendor_payment.journal_entry_id:
        raise PurchasesValidationError("Vendor payment has no journal entry to void.")

    void_journal_entry(entry=vendor_payment.journal_entry, actor_user=actor_user)

    for allocation in vendor_payment.allocations.select_related("bill").all():
        allocation.bill.amount_paid = (allocation.bill.amount_paid or Decimal("0")) - allocation.amount
        if allocation.bill.amount_paid < 0:
            allocation.bill.amount_paid = Decimal("0")
        _refresh_bill_payment_status(allocation.bill)

    vendor_payment.status = VendorPaymentStatus.VOID
    vendor_payment.save(update_fields=["status", "updated_at"])
    return vendor_payment


def build_ap_aging(*, company, as_of_date):
    rows = []
    bills = Bill.objects.filter(
        company=company,
        status__in=[BillStatus.POSTED, BillStatus.PARTIALLY_PAID, BillStatus.PAID],
    ).select_related("vendor")
    for bill in bills:
        open_amount = _bill_open_amount(bill)
        if open_amount <= 0:
            continue
        due_date = bill.due_date or bill.bill_date
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
                "bill_id": str(bill.id),
                "bill_no": bill.bill_no,
                "vendor_name": bill.vendor.name,
                "due_date": due_date,
                "open_amount": str(open_amount),
                "age_days": age_days,
                "bucket": bucket,
            }
        )
    return rows
