from django.db import models
from django.db.models import Q

from apps.accounting.models import Account
from apps.common.models import TimeStampedUUIDModel
from apps.companies.models import Company
from apps.contacts.models import Contact
from apps.journals.models import JournalEntry


class InvoiceStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    POSTED = "posted", "Posted"
    PARTIALLY_PAID = "partially_paid", "Partially Paid"
    PAID = "paid", "Paid"
    VOID = "void", "Void"


class ReceiptStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    POSTED = "posted", "Posted"
    VOID = "void", "Void"


class Invoice(TimeStampedUUIDModel):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="invoices")
    invoice_no = models.BigIntegerField(null=True, blank=True)
    status = models.CharField(max_length=30, choices=InvoiceStatus.choices, default=InvoiceStatus.DRAFT)
    customer = models.ForeignKey(Contact, on_delete=models.RESTRICT, related_name="invoices")
    issue_date = models.DateField()
    due_date = models.DateField(null=True, blank=True)
    currency_code = models.CharField(max_length=3, default="USD")
    subtotal = models.DecimalField(max_digits=19, decimal_places=4, default=0)
    tax_total = models.DecimalField(max_digits=19, decimal_places=4, default=0)
    total = models.DecimalField(max_digits=19, decimal_places=4, default=0)
    amount_paid = models.DecimalField(max_digits=19, decimal_places=4, default=0)
    notes = models.TextField(blank=True)
    ar_account = models.ForeignKey(Account, on_delete=models.RESTRICT, related_name="ar_invoices")
    journal_entry = models.ForeignKey(
        JournalEntry,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="invoices",
    )

    class Meta:
        db_table = "invoice"
        unique_together = (("company", "invoice_no"),)
        indexes = [
            models.Index(fields=["company", "status"]),
            models.Index(fields=["company", "customer"]),
            models.Index(fields=["company", "issue_date"]),
        ]
        ordering = ["-issue_date", "-created_at"]

    def __str__(self):
        return f"{self.company_id}:{self.invoice_no or 'draft'}:{self.status}"


class InvoiceLine(TimeStampedUUIDModel):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="invoice_lines")
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name="lines")
    line_no = models.PositiveIntegerField()
    description = models.TextField()
    quantity = models.DecimalField(max_digits=19, decimal_places=4, default=1)
    unit_price = models.DecimalField(max_digits=19, decimal_places=4, default=0)
    line_total = models.DecimalField(max_digits=19, decimal_places=4, default=0)
    revenue_account = models.ForeignKey(Account, on_delete=models.RESTRICT, related_name="invoice_lines")

    class Meta:
        db_table = "invoice_line"
        unique_together = (("company", "invoice", "line_no"),)
        constraints = [
            models.CheckConstraint(check=Q(quantity__gt=0), name="invoice_line_quantity_positive"),
            models.CheckConstraint(check=Q(unit_price__gte=0), name="invoice_line_unit_price_non_negative"),
        ]
        indexes = [models.Index(fields=["invoice"])]

    def __str__(self):
        return f"{self.invoice_id}:{self.line_no}"


class Receipt(TimeStampedUUIDModel):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="receipts")
    receipt_no = models.BigIntegerField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=ReceiptStatus.choices, default=ReceiptStatus.DRAFT)
    customer = models.ForeignKey(Contact, on_delete=models.RESTRICT, related_name="receipts")
    received_date = models.DateField()
    amount = models.DecimalField(max_digits=19, decimal_places=4)
    currency_code = models.CharField(max_length=3, default="USD")
    deposit_account = models.ForeignKey(Account, on_delete=models.RESTRICT, related_name="receipts")
    journal_entry = models.ForeignKey(
        JournalEntry,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="receipts",
    )
    notes = models.TextField(blank=True)

    class Meta:
        db_table = "receipt"
        unique_together = (("company", "receipt_no"),)
        indexes = [models.Index(fields=["company", "received_date"])]
        ordering = ["-received_date", "-created_at"]


class ReceiptAllocation(TimeStampedUUIDModel):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="receipt_allocations")
    receipt = models.ForeignKey(Receipt, on_delete=models.CASCADE, related_name="allocations")
    invoice = models.ForeignKey(Invoice, on_delete=models.RESTRICT, related_name="receipt_allocations")
    amount = models.DecimalField(max_digits=19, decimal_places=4)

    class Meta:
        db_table = "receipt_allocation"
        unique_together = (("company", "receipt", "invoice"),)
        constraints = [models.CheckConstraint(check=Q(amount__gt=0), name="receipt_allocation_amount_positive")]
        indexes = [models.Index(fields=["receipt"])]
