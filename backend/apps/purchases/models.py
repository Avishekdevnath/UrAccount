from django.db import models
from django.db.models import Q

from apps.accounting.models import Account
from apps.common.models import TimeStampedUUIDModel
from apps.companies.models import Company
from apps.contacts.models import Contact
from apps.journals.models import JournalEntry


class BillStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    POSTED = "posted", "Posted"
    PARTIALLY_PAID = "partially_paid", "Partially Paid"
    PAID = "paid", "Paid"
    VOID = "void", "Void"


class VendorPaymentStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    POSTED = "posted", "Posted"
    VOID = "void", "Void"


class Bill(TimeStampedUUIDModel):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="bills")
    bill_no = models.BigIntegerField(null=True, blank=True)
    status = models.CharField(max_length=30, choices=BillStatus.choices, default=BillStatus.DRAFT)
    vendor = models.ForeignKey(Contact, on_delete=models.RESTRICT, related_name="bills")
    bill_date = models.DateField()
    due_date = models.DateField(null=True, blank=True)
    currency_code = models.CharField(max_length=3, default="USD")
    subtotal = models.DecimalField(max_digits=19, decimal_places=4, default=0)
    tax_total = models.DecimalField(max_digits=19, decimal_places=4, default=0)
    total = models.DecimalField(max_digits=19, decimal_places=4, default=0)
    amount_paid = models.DecimalField(max_digits=19, decimal_places=4, default=0)
    notes = models.TextField(blank=True)
    ap_account = models.ForeignKey(Account, on_delete=models.RESTRICT, related_name="ap_bills")
    journal_entry = models.ForeignKey(
        JournalEntry,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="bills",
    )

    class Meta:
        db_table = "bill"
        unique_together = (("company", "bill_no"),)
        indexes = [
            models.Index(fields=["company", "status"]),
            models.Index(fields=["company", "vendor"]),
            models.Index(fields=["company", "bill_date"]),
        ]
        ordering = ["-bill_date", "-created_at"]

    def __str__(self):
        return f"{self.company_id}:{self.bill_no or 'draft'}:{self.status}"


class BillLine(TimeStampedUUIDModel):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="bill_lines")
    bill = models.ForeignKey(Bill, on_delete=models.CASCADE, related_name="lines")
    line_no = models.PositiveIntegerField()
    description = models.TextField()
    quantity = models.DecimalField(max_digits=19, decimal_places=4, default=1)
    unit_cost = models.DecimalField(max_digits=19, decimal_places=4, default=0)
    line_total = models.DecimalField(max_digits=19, decimal_places=4, default=0)
    expense_account = models.ForeignKey(Account, on_delete=models.RESTRICT, related_name="bill_lines")

    class Meta:
        db_table = "bill_line"
        unique_together = (("company", "bill", "line_no"),)
        constraints = [
            models.CheckConstraint(check=Q(quantity__gt=0), name="bill_line_quantity_positive"),
            models.CheckConstraint(check=Q(unit_cost__gte=0), name="bill_line_unit_cost_non_negative"),
        ]
        indexes = [models.Index(fields=["bill"])]

    def __str__(self):
        return f"{self.bill_id}:{self.line_no}"


class VendorPayment(TimeStampedUUIDModel):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="vendor_payments")
    payment_no = models.BigIntegerField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=VendorPaymentStatus.choices, default=VendorPaymentStatus.DRAFT)
    vendor = models.ForeignKey(Contact, on_delete=models.RESTRICT, related_name="vendor_payments")
    paid_date = models.DateField()
    amount = models.DecimalField(max_digits=19, decimal_places=4)
    currency_code = models.CharField(max_length=3, default="USD")
    payment_account = models.ForeignKey(Account, on_delete=models.RESTRICT, related_name="vendor_payments")
    journal_entry = models.ForeignKey(
        JournalEntry,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="vendor_payments",
    )
    notes = models.TextField(blank=True)

    class Meta:
        db_table = "vendor_payment"
        unique_together = (("company", "payment_no"),)
        indexes = [models.Index(fields=["company", "paid_date"])]
        ordering = ["-paid_date", "-created_at"]


class VendorPaymentAllocation(TimeStampedUUIDModel):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="vendor_payment_allocations")
    vendor_payment = models.ForeignKey(VendorPayment, on_delete=models.CASCADE, related_name="allocations")
    bill = models.ForeignKey(Bill, on_delete=models.RESTRICT, related_name="vendor_payment_allocations")
    amount = models.DecimalField(max_digits=19, decimal_places=4)

    class Meta:
        db_table = "vendor_payment_allocation"
        unique_together = (("company", "vendor_payment", "bill"),)
        constraints = [models.CheckConstraint(check=Q(amount__gt=0), name="vendor_payment_allocation_amount_positive")]
        indexes = [models.Index(fields=["vendor_payment"])]
