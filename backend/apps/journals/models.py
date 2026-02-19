from django.conf import settings
from django.db import models
from django.db.models import Q

from apps.accounting.models import Account
from apps.common.models import TimeStampedUUIDModel
from apps.companies.models import Company


class JournalStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    POSTED = "posted", "Posted"
    VOID = "void", "Void"


class JournalEntry(TimeStampedUUIDModel):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="journal_entries")
    entry_no = models.BigIntegerField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=JournalStatus.choices, default=JournalStatus.DRAFT)
    entry_date = models.DateField()
    description = models.TextField(blank=True)
    reference_type = models.CharField(max_length=64, blank=True)
    reference_id = models.UUIDField(null=True, blank=True)
    posted_at = models.DateTimeField(null=True, blank=True)
    posted_by_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="posted_journal_entries",
    )
    voided_at = models.DateTimeField(null=True, blank=True)
    voided_by_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="voided_journal_entries",
    )

    class Meta:
        db_table = "journal_entry"
        unique_together = (("company", "entry_no"),)
        indexes = [
            models.Index(fields=["company", "status"]),
            models.Index(fields=["company", "entry_date"]),
        ]
        ordering = ["-entry_date", "-created_at"]

    def __str__(self):
        return f"{self.company_id}:{self.entry_no or 'draft'}:{self.status}"


class JournalLine(TimeStampedUUIDModel):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="journal_lines")
    journal_entry = models.ForeignKey(JournalEntry, on_delete=models.CASCADE, related_name="lines")
    line_no = models.PositiveIntegerField()
    account = models.ForeignKey(Account, on_delete=models.RESTRICT, related_name="journal_lines")
    description = models.TextField(blank=True)
    debit = models.DecimalField(max_digits=19, decimal_places=4, default=0)
    credit = models.DecimalField(max_digits=19, decimal_places=4, default=0)

    class Meta:
        db_table = "journal_line"
        unique_together = (("company", "journal_entry", "line_no"),)
        indexes = [
            models.Index(fields=["company", "account"]),
            models.Index(fields=["journal_entry"]),
        ]
        constraints = [
            models.CheckConstraint(check=Q(debit__gte=0), name="journal_line_debit_non_negative"),
            models.CheckConstraint(check=Q(credit__gte=0), name="journal_line_credit_non_negative"),
            models.CheckConstraint(
                check=(Q(debit__gt=0, credit=0) | Q(credit__gt=0, debit=0)),
                name="journal_line_one_side_only",
            ),
        ]

    def __str__(self):
        return f"{self.journal_entry_id}:{self.line_no}"
