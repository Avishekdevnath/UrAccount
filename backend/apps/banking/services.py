import csv
from datetime import date
from decimal import Decimal, InvalidOperation
from io import StringIO

from django.db import transaction
from django.utils import timezone

from apps.banking.models import (
    BankImportStatus,
    BankReconciliation,
    BankReconciliationLine,
    BankTransaction,
    BankTransactionStatus,
    ReconciliationStatus,
)
from apps.journals.models import JournalStatus


class BankingValidationError(ValueError):
    pass


def _parse_date(value: str) -> date:
    try:
        return date.fromisoformat((value or "").strip())
    except ValueError as exc:
        raise BankingValidationError(f"Invalid date value '{value}'. Expected YYYY-MM-DD.") from exc


def _parse_amount(value: str) -> Decimal:
    try:
        return Decimal((value or "").strip())
    except (InvalidOperation, AttributeError) as exc:
        raise BankingValidationError(f"Invalid amount value '{value}'.") from exc


@transaction.atomic
def parse_statement_import(*, statement_import):
    content = statement_import.raw_content or ""
    if not content.strip():
        statement_import.status = BankImportStatus.FAILED
        statement_import.error_message = "CSV content is empty."
        statement_import.save(update_fields=["status", "error_message", "updated_at"])
        raise BankingValidationError("CSV content is empty.")

    reader = csv.DictReader(StringIO(content))
    required_candidates = ("date", "txn_date")
    if not reader.fieldnames:
        statement_import.status = BankImportStatus.FAILED
        statement_import.error_message = "CSV header row is missing."
        statement_import.save(update_fields=["status", "error_message", "updated_at"])
        raise BankingValidationError("CSV header row is missing.")

    if not any(name in reader.fieldnames for name in required_candidates) or "amount" not in reader.fieldnames:
        statement_import.status = BankImportStatus.FAILED
        statement_import.error_message = "CSV must include date/txn_date and amount columns."
        statement_import.save(update_fields=["status", "error_message", "updated_at"])
        raise BankingValidationError("CSV must include date/txn_date and amount columns.")

    created = 0
    for row in reader:
        raw_date = row.get("date") or row.get("txn_date")
        if not raw_date:
            continue
        txn_date = _parse_date(raw_date)
        amount = _parse_amount(row.get("amount", "0"))
        BankTransaction.objects.create(
            company=statement_import.company,
            bank_account=statement_import.bank_account,
            statement_import=statement_import,
            txn_date=txn_date,
            description=(row.get("description") or "").strip(),
            reference=(row.get("reference") or "").strip(),
            amount=amount,
            status=BankTransactionStatus.IMPORTED,
        )
        created += 1

    statement_import.status = BankImportStatus.PARSED
    statement_import.error_message = ""
    statement_import.save(update_fields=["status", "error_message", "updated_at"])
    return created


@transaction.atomic
def match_bank_transaction(*, bank_transaction, journal_entry):
    bank_transaction = BankTransaction.objects.select_for_update().get(id=bank_transaction.id)
    if bank_transaction.status == BankTransactionStatus.RECONCILED:
        raise BankingValidationError("Reconciled transaction cannot be rematched.")
    if journal_entry.company_id != bank_transaction.company_id:
        raise BankingValidationError("Journal entry must belong to the same company.")
    if journal_entry.status != JournalStatus.POSTED:
        raise BankingValidationError("Only posted journal entries can be matched.")

    bank_transaction.matched_journal_entry = journal_entry
    bank_transaction.status = BankTransactionStatus.MATCHED
    bank_transaction.save(update_fields=["matched_journal_entry", "status", "updated_at"])
    return bank_transaction


@transaction.atomic
def replace_reconciliation_lines(*, reconciliation: BankReconciliation, transactions: list[BankTransaction]):
    reconciliation = BankReconciliation.objects.select_for_update().get(id=reconciliation.id)
    if reconciliation.status != ReconciliationStatus.DRAFT:
        raise BankingValidationError("Only draft reconciliations can be edited.")

    for tx in transactions:
        if tx.company_id != reconciliation.company_id:
            raise BankingValidationError("Transaction must belong to the same company.")
        if tx.bank_account_id != reconciliation.bank_account_id:
            raise BankingValidationError("Transaction bank account mismatch.")
        if not (reconciliation.start_date <= tx.txn_date <= reconciliation.end_date):
            raise BankingValidationError("Transaction date is outside reconciliation period.")

    reconciliation.lines.all().delete()
    if transactions:
        BankReconciliationLine.objects.bulk_create(
            [
                BankReconciliationLine(
                    company=reconciliation.company,
                    reconciliation=reconciliation,
                    bank_transaction=tx,
                )
                for tx in transactions
            ]
        )
    return reconciliation


@transaction.atomic
def finalize_reconciliation(*, reconciliation: BankReconciliation, actor_user):
    reconciliation = BankReconciliation.objects.select_for_update().get(id=reconciliation.id)
    if reconciliation.status != ReconciliationStatus.DRAFT:
        raise BankingValidationError("Only draft reconciliations can be finalized.")
    lines = list(reconciliation.lines.select_related("bank_transaction").all())
    if not lines:
        raise BankingValidationError("Reconciliation must include at least one transaction.")

    tx_ids = [line.bank_transaction_id for line in lines]
    BankTransaction.objects.filter(id__in=tx_ids).update(status=BankTransactionStatus.RECONCILED)

    reconciliation.status = ReconciliationStatus.FINALIZED
    reconciliation.finalized_at = timezone.now()
    reconciliation.finalized_by_user = actor_user
    reconciliation.save(update_fields=["status", "finalized_at", "finalized_by_user", "updated_at"])
    return reconciliation
