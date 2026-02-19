from decimal import Decimal

from rest_framework import serializers

from apps.accounting.models import Account
from apps.contacts.models import Contact
from apps.purchases.models import Bill, BillLine, VendorPayment, VendorPaymentAllocation


class BillLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = BillLine
        fields = (
            "id",
            "line_no",
            "description",
            "quantity",
            "unit_cost",
            "line_total",
            "expense_account",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "line_total", "created_at", "updated_at")


class BillSerializer(serializers.ModelSerializer):
    lines = BillLineSerializer(many=True, read_only=True)

    class Meta:
        model = Bill
        fields = (
            "id",
            "company",
            "bill_no",
            "status",
            "vendor",
            "bill_date",
            "due_date",
            "currency_code",
            "subtotal",
            "tax_total",
            "total",
            "amount_paid",
            "notes",
            "ap_account",
            "journal_entry",
            "created_at",
            "updated_at",
            "lines",
        )
        read_only_fields = (
            "id",
            "bill_no",
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
        vendor = attrs.get("vendor") or getattr(self.instance, "vendor", None)
        ap_account = attrs.get("ap_account") or getattr(self.instance, "ap_account", None)
        if company and vendor and vendor.company_id != company.id:
            raise serializers.ValidationError({"vendor": "Vendor must belong to the selected company."})
        if vendor and vendor.type not in {"vendor", "both"}:
            raise serializers.ValidationError({"vendor": "Contact type must be vendor or both."})
        if company and ap_account and ap_account.company_id != company.id:
            raise serializers.ValidationError({"ap_account": "AP account must belong to the selected company."})
        return attrs


class BillLinesReplaceSerializer(serializers.Serializer):
    lines = serializers.ListField(child=serializers.DictField(), allow_empty=False)

    def to_service_payload(self, *, company):
        payload = []
        account_ids = [str(line.get("expense_account_id")) for line in self.validated_data["lines"]]
        accounts = {str(account.id): account for account in Account.objects.filter(company=company, id__in=account_ids)}

        for idx, line in enumerate(self.validated_data["lines"], start=1):
            account_id = str(line.get("expense_account_id"))
            account = accounts.get(account_id)
            if not account:
                raise serializers.ValidationError("Expense account must belong to the same company.")
            quantity = Decimal(str(line.get("quantity", "1")))
            unit_cost = Decimal(str(line.get("unit_cost", "0")))
            payload.append(
                {
                    "line_no": line.get("line_no") or idx,
                    "description": line.get("description", ""),
                    "quantity": quantity,
                    "unit_cost": unit_cost,
                    "expense_account": account,
                }
            )
        return payload


class VendorPaymentAllocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = VendorPaymentAllocation
        fields = ("id", "bill", "amount", "created_at")
        read_only_fields = ("id", "created_at")


class VendorPaymentSerializer(serializers.ModelSerializer):
    allocations = VendorPaymentAllocationSerializer(many=True, read_only=True)

    class Meta:
        model = VendorPayment
        fields = (
            "id",
            "company",
            "payment_no",
            "status",
            "vendor",
            "paid_date",
            "amount",
            "currency_code",
            "payment_account",
            "journal_entry",
            "notes",
            "created_at",
            "updated_at",
            "allocations",
        )
        read_only_fields = (
            "id",
            "payment_no",
            "journal_entry",
            "created_at",
            "updated_at",
            "allocations",
        )
        extra_kwargs = {"company": {"required": False}}
        validators = []

    def validate(self, attrs):
        company = self.context.get("company") or attrs.get("company") or getattr(self.instance, "company", None)
        vendor = attrs.get("vendor") or getattr(self.instance, "vendor", None)
        payment_account = attrs.get("payment_account") or getattr(self.instance, "payment_account", None)
        if company and vendor and vendor.company_id != company.id:
            raise serializers.ValidationError({"vendor": "Vendor must belong to the selected company."})
        if vendor and vendor.type not in {"vendor", "both"}:
            raise serializers.ValidationError({"vendor": "Contact type must be vendor or both."})
        if company and payment_account and payment_account.company_id != company.id:
            raise serializers.ValidationError(
                {"payment_account": "Payment account must belong to the selected company."}
            )
        return attrs


class VendorPaymentAllocationsReplaceSerializer(serializers.Serializer):
    allocations = serializers.ListField(child=serializers.DictField(), allow_empty=False)

    def to_service_payload(self, *, company):
        payload = []
        bill_ids = [str(item.get("bill_id")) for item in self.validated_data["allocations"]]
        bills = {str(bill.id): bill for bill in Bill.objects.filter(company=company, id__in=bill_ids)}

        for item in self.validated_data["allocations"]:
            bill = bills.get(str(item.get("bill_id")))
            if not bill:
                raise serializers.ValidationError("Allocation bill must belong to the same company.")
            payload.append(
                {
                    "bill": bill,
                    "amount": Decimal(str(item.get("amount", "0"))),
                }
            )
        return payload


class APAgingQuerySerializer(serializers.Serializer):
    as_of = serializers.DateField(required=False)
