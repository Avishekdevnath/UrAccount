from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from apps.accounting.services import get_next_sequence_value
from apps.journals.models import JournalEntry, JournalLine, JournalStatus


class JournalValidationError(ValueError):
    pass


def _assert_draft(entry: JournalEntry):
    if entry.status != JournalStatus.DRAFT:
        raise JournalValidationError("Only draft journal entries can be modified.")


def _assert_balanced(entry: JournalEntry):
    totals = entry.lines.aggregate(
        debit_total=Sum("debit"),
        credit_total=Sum("credit"),
    )
    debit_total = totals["debit_total"] or Decimal("0")
    credit_total = totals["credit_total"] or Decimal("0")
    if debit_total <= 0 or credit_total <= 0 or debit_total != credit_total:
        raise JournalValidationError("Journal entry is not balanced (debit must equal credit).")


@transaction.atomic
def replace_journal_lines(*, entry: JournalEntry, lines: list[dict]):
    entry = JournalEntry.objects.select_for_update().get(id=entry.id)
    _assert_draft(entry)

    if not lines:
        raise JournalValidationError("At least one journal line is required.")

    entry.lines.all().delete()

    for idx, line in enumerate(lines, start=1):
        account = line["account"]
        if account.company_id != entry.company_id:
            raise JournalValidationError("Journal line account must belong to the same company.")

        JournalLine.objects.create(
            company=entry.company,
            journal_entry=entry,
            line_no=line.get("line_no") or idx,
            account=account,
            description=line.get("description", ""),
            debit=line.get("debit", 0),
            credit=line.get("credit", 0),
        )

    _assert_balanced(entry)
    return entry


@transaction.atomic
def post_journal_entry(*, entry: JournalEntry, actor_user):
    entry = JournalEntry.objects.select_for_update().get(id=entry.id)
    _assert_draft(entry)

    if not entry.lines.exists():
        raise JournalValidationError("Journal entry has no lines.")

    _assert_balanced(entry)

    if not entry.entry_no:
        entry.entry_no = get_next_sequence_value(company=entry.company, key="journal_entry")

    entry.status = JournalStatus.POSTED
    entry.posted_at = timezone.now()
    entry.posted_by_user = actor_user
    entry.save(update_fields=["entry_no", "status", "posted_at", "posted_by_user", "updated_at"])
    return entry


@transaction.atomic
def void_journal_entry(*, entry: JournalEntry, actor_user):
    entry = JournalEntry.objects.select_for_update().get(id=entry.id)
    if entry.status != JournalStatus.POSTED:
        raise JournalValidationError("Only posted journal entries can be voided.")

    reversal_entry = JournalEntry.objects.create(
        company=entry.company,
        entry_no=get_next_sequence_value(company=entry.company, key="journal_entry"),
        status=JournalStatus.POSTED,
        entry_date=timezone.now().date(),
        description=f"Reversal of JE #{entry.entry_no or entry.id}",
        reference_type="journal_reversal",
        reference_id=entry.id,
        posted_at=timezone.now(),
        posted_by_user=actor_user,
    )

    reversal_lines = []
    for line in entry.lines.select_related("account").all().order_by("line_no"):
        reversal_lines.append(
            JournalLine(
                company=entry.company,
                journal_entry=reversal_entry,
                line_no=line.line_no,
                account=line.account,
                description=f"Reversal: {line.description}".strip(),
                debit=line.credit,
                credit=line.debit,
            )
        )
    JournalLine.objects.bulk_create(reversal_lines)

    entry.status = JournalStatus.VOID
    entry.voided_at = timezone.now()
    entry.voided_by_user = actor_user
    entry.save(update_fields=["status", "voided_at", "voided_by_user", "updated_at"])

    return entry, reversal_entry
