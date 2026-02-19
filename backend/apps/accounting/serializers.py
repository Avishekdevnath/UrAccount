from rest_framework import serializers

from apps.accounting.models import Account


class AccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = Account
        fields = (
            "id",
            "company",
            "code",
            "name",
            "type",
            "normal_balance",
            "parent",
            "is_active",
            "is_system",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "is_system", "created_at", "updated_at")
        extra_kwargs = {"company": {"required": False}}
        validators = []

    def validate(self, attrs):
        company = attrs.get("company") or self.context.get("company") or getattr(self.instance, "company", None)
        parent = attrs.get("parent")
        if parent and company and parent.company_id != company.id:
            raise serializers.ValidationError("Parent account must belong to the same company.")

        code = attrs.get("code") or getattr(self.instance, "code", None)
        if company and code:
            queryset = Account.objects.filter(company=company, code=code)
            if self.instance:
                queryset = queryset.exclude(id=self.instance.id)
            if queryset.exists():
                raise serializers.ValidationError({"code": "Account code must be unique within company."})
        return attrs


class AccountTreeSerializer(serializers.ModelSerializer):
    children = serializers.SerializerMethodField()

    class Meta:
        model = Account
        fields = ("id", "code", "name", "type", "normal_balance", "is_active", "children")

    def get_children(self, obj):
        children = obj.children.all().order_by("code")
        return AccountTreeSerializer(children, many=True).data
