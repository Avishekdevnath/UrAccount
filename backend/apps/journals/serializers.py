from decimal import Decimal

from rest_framework import serializers

from apps.accounting.models import Account
from apps.journals.models import JournalEntry, JournalLine


class JournalLineSerializer(serializers.ModelSerializer):
    account_code = serializers.CharField(source="account.code", read_only=True)
    account_name = serializers.CharField(source="account.name", read_only=True)

    class Meta:
        model = JournalLine
        fields = (
            "id",
            "line_no",
            "account",
            "account_code",
            "account_name",
            "description",
            "debit",
            "credit",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at", "account_code", "account_name")


class JournalLineInputSerializer(serializers.Serializer):
    line_no = serializers.IntegerField(required=False, min_value=1)
    account_id = serializers.UUIDField()
    description = serializers.CharField(required=False, allow_blank=True)
    debit = serializers.DecimalField(max_digits=19, decimal_places=4, default=Decimal("0"))
    credit = serializers.DecimalField(max_digits=19, decimal_places=4, default=Decimal("0"))


class JournalEntrySerializer(serializers.ModelSerializer):
    lines = JournalLineSerializer(many=True, read_only=True)

    class Meta:
        model = JournalEntry
        fields = (
            "id",
            "company",
            "entry_no",
            "status",
            "entry_date",
            "description",
            "reference_type",
            "reference_id",
            "posted_at",
            "posted_by_user",
            "voided_at",
            "voided_by_user",
            "created_at",
            "updated_at",
            "lines",
        )
        read_only_fields = (
            "id",
            "entry_no",
            "posted_at",
            "posted_by_user",
            "voided_at",
            "voided_by_user",
            "created_at",
            "updated_at",
            "lines",
        )
        extra_kwargs = {"company": {"required": False}}
        validators = []


class JournalLinesReplaceSerializer(serializers.Serializer):
    lines = JournalLineInputSerializer(many=True)

    def validate_lines(self, value):
        if not value:
            raise serializers.ValidationError("At least one line is required.")
        return value

    def to_service_payload(self, *, company):
        payload = []
        account_ids = [line["account_id"] for line in self.validated_data["lines"]]
        accounts = {str(account.id): account for account in Account.objects.filter(company=company, id__in=account_ids)}

        for line in self.validated_data["lines"]:
            account = accounts.get(str(line["account_id"]))
            if not account:
                raise serializers.ValidationError("All accounts must belong to the selected company.")
            payload.append(
                {
                    "line_no": line.get("line_no"),
                    "account": account,
                    "description": line.get("description", ""),
                    "debit": line["debit"],
                    "credit": line["credit"],
                }
            )
        return payload
