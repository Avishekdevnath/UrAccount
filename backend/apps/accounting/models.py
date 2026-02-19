from django.db import models

from apps.common.models import TimeStampedUUIDModel
from apps.companies.models import Company


class AccountType(models.TextChoices):
    ASSET = "asset", "Asset"
    LIABILITY = "liability", "Liability"
    EQUITY = "equity", "Equity"
    INCOME = "income", "Income"
    EXPENSE = "expense", "Expense"


class NormalBalance(models.TextChoices):
    DEBIT = "debit", "Debit"
    CREDIT = "credit", "Credit"


class Account(TimeStampedUUIDModel):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="accounts")
    code = models.CharField(max_length=32)
    name = models.CharField(max_length=255)
    type = models.CharField(max_length=20, choices=AccountType.choices)
    normal_balance = models.CharField(max_length=20, choices=NormalBalance.choices)
    parent = models.ForeignKey("self", on_delete=models.SET_NULL, null=True, blank=True, related_name="children")
    is_active = models.BooleanField(default=True)
    is_system = models.BooleanField(default=False)

    class Meta:
        db_table = "account"
        unique_together = (("company", "code"),)
        indexes = [
            models.Index(fields=["company", "type"]),
            models.Index(fields=["company", "parent"]),
        ]
        ordering = ["code"]

    def __str__(self):
        return f"{self.company_id}:{self.code}:{self.name}"


class NumberSequence(TimeStampedUUIDModel):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="number_sequences")
    key = models.CharField(max_length=64)
    next_value = models.BigIntegerField(default=1)

    class Meta:
        db_table = "number_sequence"
        unique_together = (("company", "key"),)
        indexes = [models.Index(fields=["company", "key"])]

    def __str__(self):
        return f"{self.company_id}:{self.key}:{self.next_value}"
