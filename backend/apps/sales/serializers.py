from decimal import Decimal

from rest_framework import serializers

from apps.accounting.models import Account
from apps.contacts.models import Contact
from apps.sales.models import Invoice, InvoiceLine, Receipt, ReceiptAllocation


class InvoiceLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceLine
        fields = (
            "id",
            "line_no",
            "description",
            "quantity",
            "unit_price",
            "line_total",
            "revenue_account",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "line_total", "created_at", "updated_at")


class InvoiceSerializer(serializers.ModelSerializer):
    lines = InvoiceLineSerializer(many=True, read_only=True)

    class Meta:
        model = Invoice
        fields = (
            "id",
            "company",
            "invoice_no",
            "status",
            "customer",
            "issue_date",
            "due_date",
            "currency_code",
            "subtotal",
            "tax_total",
            "total",
            "amount_paid",
            "notes",
            "ar_account",
            "journal_entry",
            "created_at",
            "updated_at",
            "lines",
        )
        read_only_fields = (
            "id",
            "invoice_no",
            "subtotal",
            "tax_total",
            "total",
            "amount_paid",
            "journal_entry",
            "created_at",
            "updated_at",
            "lines",
        )
        extra_kwargs = {"company": {"required": False}}
        validators = []

    def validate(self, attrs):
        company = self.context.get("company") or attrs.get("company") or getattr(self.instance, "company", None)
        customer = attrs.get("customer") or getattr(self.instance, "customer", None)
        ar_account = attrs.get("ar_account") or getattr(self.instance, "ar_account", None)
        if company and customer and customer.company_id != company.id:
            raise serializers.ValidationError({"customer": "Customer must belong to the selected company."})
        if company and ar_account and ar_account.company_id != company.id:
            raise serializers.ValidationError({"ar_account": "AR account must belong to the selected company."})
        if customer and customer.type not in {"customer", "both"}:
            raise serializers.ValidationError({"customer": "Contact type must be customer or both."})
        return attrs


class InvoiceLinesReplaceSerializer(serializers.Serializer):
    lines = serializers.ListField(child=serializers.DictField(), allow_empty=False)

    def to_service_payload(self, *, company):
        payload = []
        account_ids = [str(line.get("revenue_account_id")) for line in self.validated_data["lines"]]
        accounts = {str(account.id): account for account in Account.objects.filter(company=company, id__in=account_ids)}

        for idx, line in enumerate(self.validated_data["lines"], start=1):
            account_id = str(line.get("revenue_account_id"))
            account = accounts.get(account_id)
            if not account:
                raise serializers.ValidationError("Revenue account must belong to the same company.")
            quantity = Decimal(str(line.get("quantity", "1")))
            unit_price = Decimal(str(line.get("unit_price", "0")))
            payload.append(
                {
                    "line_no": line.get("line_no") or idx,
                    "description": line.get("description", ""),
                    "quantity": quantity,
                    "unit_price": unit_price,
                    "revenue_account": account,
                }
            )
        return payload


class ReceiptAllocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReceiptAllocation
        fields = ("id", "invoice", "amount", "created_at")
        read_only_fields = ("id", "created_at")


class ReceiptSerializer(serializers.ModelSerializer):
    allocations = ReceiptAllocationSerializer(many=True, read_only=True)

    class Meta:
        model = Receipt
        fields = (
            "id",
            "company",
            "receipt_no",
            "status",
            "customer",
            "received_date",
            "amount",
            "currency_code",
            "deposit_account",
            "journal_entry",
            "notes",
            "created_at",
            "updated_at",
            "allocations",
        )
        read_only_fields = (
            "id",
            "receipt_no",
            "journal_entry",
            "created_at",
            "updated_at",
            "allocations",
        )
        extra_kwargs = {"company": {"required": False}}
        validators = []

    def validate(self, attrs):
        company = self.context.get("company") or attrs.get("company") or getattr(self.instance, "company", None)
        customer = attrs.get("customer") or getattr(self.instance, "customer", None)
        deposit_account = attrs.get("deposit_account") or getattr(self.instance, "deposit_account", None)
        if company and customer and customer.company_id != company.id:
            raise serializers.ValidationError({"customer": "Customer must belong to the selected company."})
        if customer and customer.type not in {"customer", "both"}:
            raise serializers.ValidationError({"customer": "Contact type must be customer or both."})
        if company and deposit_account and deposit_account.company_id != company.id:
            raise serializers.ValidationError({"deposit_account": "Deposit account must belong to the selected company."})
        return attrs


class ReceiptAllocationsReplaceSerializer(serializers.Serializer):
    allocations = serializers.ListField(child=serializers.DictField(), allow_empty=False)

    def to_service_payload(self, *, company):
        payload = []
        invoice_ids = [str(item.get("invoice_id")) for item in self.validated_data["allocations"]]
        invoices = {str(inv.id): inv for inv in Invoice.objects.filter(company=company, id__in=invoice_ids)}

        for item in self.validated_data["allocations"]:
            invoice = invoices.get(str(item.get("invoice_id")))
            if not invoice:
                raise serializers.ValidationError("Allocation invoice must belong to the same company.")
            payload.append(
                {
                    "invoice": invoice,
                    "amount": Decimal(str(item.get("amount", "0"))),
                }
            )
        return payload


class ARAgingQuerySerializer(serializers.Serializer):
    as_of = serializers.DateField(required=False)
