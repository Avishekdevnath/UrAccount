from django.conf import settings
from django.db import models

from apps.accounting.models import Account
from apps.common.models import TimeStampedUUIDModel
from apps.companies.models import Company
from apps.journals.models import JournalEntry


class BankImportStatus(models.TextChoices):
    UPLOADED = "uploaded", "Uploaded"
    PARSED = "parsed", "Parsed"
    FAILED = "failed", "Failed"


class BankTransactionStatus(models.TextChoices):
    IMPORTED = "imported", "Imported"
    MATCHED = "matched", "Matched"
    RECONCILED = "reconciled", "Reconciled"
    IGNORED = "ignored", "Ignored"


class ReconciliationStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    FINALIZED = "finalized", "Finalized"


class BankAccount(TimeStampedUUIDModel):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="bank_accounts")
    name = models.CharField(max_length=255)
    account_number_last4 = models.CharField(max_length=4, blank=True)
    currency_code = models.CharField(max_length=3, default="USD")
    ledger_account = models.ForeignKey(Account, on_delete=models.RESTRICT, related_name="bank_accounts")
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "bank_account"
        indexes = [models.Index(fields=["company", "is_active"])]
        ordering = ["name"]


class BankStatementImport(TimeStampedUUIDModel):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="bank_statement_imports")
    bank_account = models.ForeignKey(BankAccount, on_delete=models.CASCADE, related_name="imports")
    file_name = models.CharField(max_length=255)
    status = models.CharField(max_length=20, choices=BankImportStatus.choices, default=BankImportStatus.UPLOADED)
    raw_content = models.TextField(blank=True)
    error_message = models.TextField(blank=True)
    imported_by_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="bank_statement_imports",
    )

    class Meta:
        db_table = "bank_statement_import"
        indexes = [models.Index(fields=["company", "status"])]
        ordering = ["-created_at"]


class BankTransaction(TimeStampedUUIDModel):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="bank_transactions")
    bank_account = models.ForeignKey(BankAccount, on_delete=models.CASCADE, related_name="transactions")
    statement_import = models.ForeignKey(
        BankStatementImport,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="transactions",
    )
    txn_date = models.DateField()
    description = models.TextField(blank=True)
    reference = models.CharField(max_length=128, blank=True)
    amount = models.DecimalField(max_digits=19, decimal_places=4)
    status = models.CharField(max_length=20, choices=BankTransactionStatus.choices, default=BankTransactionStatus.IMPORTED)
    matched_journal_entry = models.ForeignKey(
        JournalEntry,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="bank_transactions",
    )

    class Meta:
        db_table = "bank_transaction"
        indexes = [
            models.Index(fields=["company", "status"]),
            models.Index(fields=["company", "txn_date"]),
            models.Index(fields=["company", "bank_account"]),
        ]
        ordering = ["-txn_date", "-created_at"]


class BankReconciliation(TimeStampedUUIDModel):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="bank_reconciliations")
    bank_account = models.ForeignKey(BankAccount, on_delete=models.CASCADE, related_name="reconciliations")
    start_date = models.DateField()
    end_date = models.DateField()
    opening_balance = models.DecimalField(max_digits=19, decimal_places=4, default=0)
    closing_balance = models.DecimalField(max_digits=19, decimal_places=4, default=0)
    status = models.CharField(max_length=20, choices=ReconciliationStatus.choices, default=ReconciliationStatus.DRAFT)
    finalized_at = models.DateTimeField(null=True, blank=True)
    finalized_by_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="finalized_bank_reconciliations",
    )

    class Meta:
        db_table = "bank_reconciliation"
        indexes = [
            models.Index(fields=["company", "status"]),
            models.Index(fields=["company", "bank_account"]),
        ]
        ordering = ["-end_date", "-created_at"]


class BankReconciliationLine(TimeStampedUUIDModel):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="bank_reconciliation_lines")
    reconciliation = models.ForeignKey(BankReconciliation, on_delete=models.CASCADE, related_name="lines")
    bank_transaction = models.ForeignKey(BankTransaction, on_delete=models.RESTRICT, related_name="reconciliation_lines")

    class Meta:
        db_table = "bank_reconciliation_line"
        unique_together = (("company", "reconciliation", "bank_transaction"),)
        indexes = [models.Index(fields=["reconciliation"])]
