from rest_framework import serializers

from apps.accounting.models import Account
from apps.banking.models import (
    BankAccount,
    BankReconciliation,
    BankReconciliationLine,
    BankStatementImport,
    BankTransaction,
)
from apps.journals.models import JournalEntry, JournalStatus


class BankAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = BankAccount
        fields = (
            "id",
            "company",
            "name",
            "account_number_last4",
            "currency_code",
            "ledger_account",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")
        extra_kwargs = {"company": {"required": False}}
        validators = []

    def validate(self, attrs):
        company = self.context.get("company") or attrs.get("company") or getattr(self.instance, "company", None)
        ledger_account = attrs.get("ledger_account") or getattr(self.instance, "ledger_account", None)
        if company and ledger_account and ledger_account.company_id != company.id:
            raise serializers.ValidationError({"ledger_account": "Ledger account must belong to the selected company."})
        return attrs


class BankStatementImportSerializer(serializers.ModelSerializer):
    class Meta:
        model = BankStatementImport
        fields = (
            "id",
            "company",
            "bank_account",
            "file_name",
            "status",
            "raw_content",
            "error_message",
            "imported_by_user",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "status",
            "error_message",
            "imported_by_user",
            "created_at",
            "updated_at",
        )
        extra_kwargs = {"company": {"required": False}}
        validators = []

    def validate_bank_account(self, value):
        company = self.context.get("company") or getattr(self.instance, "company", None)
        if company and value.company_id != company.id:
            raise serializers.ValidationError("Bank account must belong to the selected company.")
        return value


class BankTransactionSerializer(serializers.ModelSerializer):
    bank_account_name = serializers.CharField(source="bank_account.name", read_only=True)
    matched_entry_no = serializers.IntegerField(source="matched_journal_entry.entry_no", read_only=True)

    class Meta:
        model = BankTransaction
        fields = (
            "id",
            "company",
            "bank_account",
            "bank_account_name",
            "statement_import",
            "txn_date",
            "description",
            "reference",
            "amount",
            "status",
            "matched_journal_entry",
            "matched_entry_no",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at", "bank_account_name", "matched_entry_no")


class TransactionMatchSerializer(serializers.Serializer):
    journal_entry_id = serializers.UUIDField()

    def validate_journal_entry_id(self, value):
        company = self.context["company"]
        try:
            entry = JournalEntry.objects.get(id=value, company=company, status=JournalStatus.POSTED)
        except JournalEntry.DoesNotExist as exc:
            raise serializers.ValidationError("Posted journal entry not found for this company.") from exc
        self.context["journal_entry"] = entry
        return value


class BankReconciliationSerializer(serializers.ModelSerializer):
    class Meta:
        model = BankReconciliation
        fields = (
            "id",
            "company",
            "bank_account",
            "start_date",
            "end_date",
            "opening_balance",
            "closing_balance",
            "status",
            "finalized_at",
            "finalized_by_user",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "status", "finalized_at", "finalized_by_user", "created_at", "updated_at")
        extra_kwargs = {"company": {"required": False}}
        validators = []

    def validate(self, attrs):
        company = self.context.get("company") or attrs.get("company") or getattr(self.instance, "company", None)
        bank_account = attrs.get("bank_account") or getattr(self.instance, "bank_account", None)
        start_date = attrs.get("start_date") or getattr(self.instance, "start_date", None)
        end_date = attrs.get("end_date") or getattr(self.instance, "end_date", None)
        if company and bank_account and bank_account.company_id != company.id:
            raise serializers.ValidationError({"bank_account": "Bank account must belong to the selected company."})
        if start_date and end_date and start_date > end_date:
            raise serializers.ValidationError({"end_date": "End date must be greater than or equal to start date."})
        return attrs


class BankReconciliationLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = BankReconciliationLine
        fields = ("id", "reconciliation", "bank_transaction", "created_at")
        read_only_fields = ("id", "created_at")


class ReconciliationLinesReplaceSerializer(serializers.Serializer):
    transaction_ids = serializers.ListField(child=serializers.UUIDField(), allow_empty=True)

    def to_service_payload(self, *, company):
        transactions = BankTransaction.objects.filter(company=company, id__in=self.validated_data["transaction_ids"])
        indexed = {str(tx.id): tx for tx in transactions}
        payload = []
        for tx_id in self.validated_data["transaction_ids"]:
            tx = indexed.get(str(tx_id))
            if not tx:
                raise serializers.ValidationError("All transactions must belong to the selected company.")
            payload.append(tx)
        return payload
