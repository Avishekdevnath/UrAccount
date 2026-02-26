from django.conf import settings
from rest_framework import serializers

from apps.companies.models import Company, CompanyMember, CompanyMemberStatus
from apps.rbac.models import CompanyRole
from apps.system_admin.models import SystemAuditLog, SystemCompanyConfig
from apps.users.models import User


class SystemCompanySerializer(serializers.ModelSerializer):
    members_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Company
        fields = (
            "id",
            "name",
            "slug",
            "base_currency",
            "timezone",
            "fiscal_year_start_month",
            "is_active",
            "members_count",
            "created_at",
            "updated_at",
        )


class SystemCompanyFeatureFlagsSerializer(serializers.Serializer):
    ai_enabled = serializers.BooleanField(default=False)
    ai_suggestions_enabled = serializers.BooleanField(default=False)
    ai_rag_enabled = serializers.BooleanField(default=False)
    extra_flags = serializers.JSONField(default=dict)

    @staticmethod
    def from_config(config: SystemCompanyConfig | None) -> dict:
        if config is None:
            return {
                "ai_enabled": False,
                "ai_suggestions_enabled": False,
                "ai_rag_enabled": False,
                "extra_flags": {},
            }
        return {
            "ai_enabled": config.ai_enabled,
            "ai_suggestions_enabled": config.ai_suggestions_enabled,
            "ai_rag_enabled": config.ai_rag_enabled,
            "extra_flags": config.extra_flags or {},
        }


class SystemCompanyFeatureFlagsUpdateSerializer(serializers.Serializer):
    ai_enabled = serializers.BooleanField(required=False)
    ai_suggestions_enabled = serializers.BooleanField(required=False)
    ai_rag_enabled = serializers.BooleanField(required=False)
    extra_flags = serializers.JSONField(required=False)

    def validate_extra_flags(self, value):
        if value is None:
            return {}
        if not isinstance(value, dict):
            raise serializers.ValidationError("extra_flags must be an object.")
        if len(value) > 50:
            raise serializers.ValidationError("extra_flags supports up to 50 keys.")

        normalized = {}
        for raw_key, raw_value in value.items():
            key = str(raw_key).strip()
            if not key:
                raise serializers.ValidationError("extra_flags keys cannot be empty.")
            if len(key) > 64:
                raise serializers.ValidationError(f"extra_flags key '{key}' exceeds 64 chars.")
            normalized[key] = raw_value
        return normalized


class SystemCompanyQuotasSerializer(serializers.Serializer):
    max_users = serializers.IntegerField(required=False, allow_null=True)
    max_storage_mb = serializers.IntegerField(required=False, allow_null=True)
    max_api_requests_per_minute = serializers.IntegerField(required=False, allow_null=True)

    @staticmethod
    def from_config(config: SystemCompanyConfig | None) -> dict:
        if config is None:
            return {
                "max_users": None,
                "max_storage_mb": None,
                "max_api_requests_per_minute": None,
            }
        return {
            "max_users": config.max_users,
            "max_storage_mb": config.max_storage_mb,
            "max_api_requests_per_minute": config.max_api_requests_per_minute,
        }


class SystemCompanyQuotasUpdateSerializer(serializers.Serializer):
    max_users = serializers.IntegerField(required=False, allow_null=True, min_value=1, max_value=100000)
    max_storage_mb = serializers.IntegerField(required=False, allow_null=True, min_value=1, max_value=1000000)
    max_api_requests_per_minute = serializers.IntegerField(
        required=False,
        allow_null=True,
        min_value=1,
        max_value=100000,
    )


class SystemCompanyDetailSerializer(SystemCompanySerializer):
    feature_flags = serializers.SerializerMethodField()
    quotas = serializers.SerializerMethodField()

    class Meta(SystemCompanySerializer.Meta):
        fields = SystemCompanySerializer.Meta.fields + ("feature_flags", "quotas")

    @staticmethod
    def _config(company: Company) -> SystemCompanyConfig | None:
        return getattr(company, "system_config", None)

    def get_feature_flags(self, company: Company) -> dict:
        config = self._config(company)
        return SystemCompanyFeatureFlagsSerializer.from_config(config)

    def get_quotas(self, company: Company) -> dict:
        config = self._config(company)
        return SystemCompanyQuotasSerializer.from_config(config)


class SystemUserSerializer(serializers.ModelSerializer):
    company_count = serializers.IntegerField(read_only=True)
    system_role = serializers.CharField(source="system_role.role", read_only=True)
    system_role_active = serializers.BooleanField(source="system_role.is_active", read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "full_name",
            "is_active",
            "is_staff",
            "is_superuser",
            "company_count",
            "system_role",
            "system_role_active",
            "created_at",
            "updated_at",
        )


class SystemUserMembershipSerializer(serializers.ModelSerializer):
    company_id = serializers.UUIDField(source="company.id", read_only=True)
    company_slug = serializers.CharField(source="company.slug", read_only=True)
    company_name = serializers.CharField(source="company.name", read_only=True)
    company_is_active = serializers.BooleanField(source="company.is_active", read_only=True)

    class Meta:
        model = CompanyMember
        fields = (
            "id",
            "company_id",
            "company_slug",
            "company_name",
            "company_is_active",
            "status",
            "joined_at",
            "created_at",
            "updated_at",
        )


class SystemUserDetailSerializer(SystemUserSerializer):
    memberships = SystemUserMembershipSerializer(source="company_memberships", many=True, read_only=True)

    class Meta(SystemUserSerializer.Meta):
        fields = SystemUserSerializer.Meta.fields + ("memberships",)


class SystemFeatureFlagsSerializer(serializers.Serializer):
    system_admin_enabled = serializers.BooleanField(default=False)
    ai_enabled = serializers.BooleanField(default=False)
    subscription_enabled = serializers.BooleanField(default=False)
    browsable_api_enabled = serializers.BooleanField(default=False)

    @staticmethod
    def from_settings() -> dict:
        return {
            "system_admin_enabled": bool(getattr(settings, "SYSTEM_ADMIN_ENABLED", False)),
            "ai_enabled": bool(getattr(settings, "AI_ENABLED", False)),
            "subscription_enabled": bool(getattr(settings, "SUBSCRIPTION_ENABLED", False)),
            "browsable_api_enabled": bool(getattr(settings, "ENABLE_BROWSABLE_API", False)),
        }


class SystemCompanyStatusUpdateSerializer(serializers.Serializer):
    is_active = serializers.BooleanField()


class SystemCompanyBootstrapCompanySerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    slug = serializers.SlugField(max_length=255)
    base_currency = serializers.CharField(max_length=3, default="USD")
    timezone = serializers.CharField(max_length=128, default="UTC")
    fiscal_year_start_month = serializers.IntegerField(default=1, min_value=1, max_value=12)

    def validate_slug(self, value: str) -> str:
        slug = value.strip().lower()
        if Company.objects.filter(slug=slug).exists():
            raise serializers.ValidationError("A company with this slug already exists.")
        return slug

    def validate_base_currency(self, value: str) -> str:
        return value.strip().upper()


class SystemCompanyBootstrapOwnerSerializer(serializers.Serializer):
    email = serializers.EmailField()
    full_name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    password = serializers.CharField(required=False, allow_blank=True, write_only=True, min_length=8)


class SystemCompanyBootstrapSerializer(serializers.Serializer):
    company = SystemCompanyBootstrapCompanySerializer()
    owner = SystemCompanyBootstrapOwnerSerializer()

    def validate(self, attrs):
        owner = attrs["owner"]
        owner_email = owner["email"].strip().lower()
        owner["email"] = owner_email

        existing_owner = User.objects.filter(email__iexact=owner_email).first()
        if existing_owner is None:
            full_name = owner.get("full_name", "").strip()
            password = owner.get("password", "")
            if not full_name:
                raise serializers.ValidationError(
                    {"owner": {"full_name": ["full_name is required when creating a new owner account."]}}
                )
            if not password:
                raise serializers.ValidationError(
                    {"owner": {"password": ["password is required when creating a new owner account."]}}
                )
        return attrs


class SystemUserRoleUpdateSerializer(serializers.Serializer):
    role = serializers.ChoiceField(
        choices=["SUPER_ADMIN", "SUPPORT"],
        required=False,
        allow_null=True,
        help_text="Set to null to revoke the system role entirely.",
    )
    is_active = serializers.BooleanField(required=False)


class SystemUserCreateSerializer(serializers.Serializer):
    email = serializers.EmailField()
    full_name = serializers.CharField(max_length=255)
    password = serializers.CharField(write_only=True, min_length=8)
    is_active = serializers.BooleanField(required=False, default=True)
    is_staff = serializers.BooleanField(required=False, default=False)

    def validate_email(self, value: str) -> str:
        email = value.strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return email


class SystemUserUpdateSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=255, required=False)
    is_active = serializers.BooleanField(required=False)
    is_staff = serializers.BooleanField(required=False)


class SystemUserResetPasswordSerializer(serializers.Serializer):
    new_password = serializers.CharField(write_only=True, min_length=8)


class SystemCompanyMemberUpsertSerializer(serializers.Serializer):
    user_id = serializers.UUIDField()
    status = serializers.ChoiceField(choices=CompanyMemberStatus.choices, required=False, default=CompanyMemberStatus.ACTIVE)
    roles = serializers.ListField(child=serializers.CharField(max_length=100), required=False, default=list)

    def validate_roles(self, value: list[str]) -> list[str]:
        if not value:
            return []
        normalized = []
        seen = set()
        for role_name in value:
            name = role_name.strip()
            if not name:
                continue
            key = name.lower()
            if key in seen:
                continue
            seen.add(key)
            normalized.append(name)
        return normalized


class SystemCompanyMemberRolesUpdateSerializer(serializers.Serializer):
    roles = serializers.ListField(child=serializers.CharField(max_length=100), allow_empty=True)

    def validate_roles(self, value: list[str]) -> list[str]:
        normalized = []
        seen = set()
        for role_name in value:
            name = role_name.strip()
            if not name:
                continue
            key = name.lower()
            if key in seen:
                continue
            seen.add(key)
            normalized.append(name)
        return normalized


class SystemCompanyMemberSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)
    user_full_name = serializers.CharField(source="user.full_name", read_only=True)
    roles = serializers.SerializerMethodField()

    class Meta:
        model = CompanyMember
        fields = (
            "id",
            "company",
            "user",
            "user_email",
            "user_full_name",
            "status",
            "joined_at",
            "created_at",
            "updated_at",
            "roles",
        )

    def get_roles(self, obj: CompanyMember) -> list[str]:
        roles = CompanyRole.objects.filter(assignments__company=obj.company, assignments__user=obj.user).values_list("name", flat=True)
        return sorted(set(roles))


class SystemAuditLogSerializer(serializers.ModelSerializer):
    actor_email = serializers.SerializerMethodField()
    request_id = serializers.SerializerMethodField()

    class Meta:
        model = SystemAuditLog
        fields = (
            "id",
            "actor_email",
            "ip_address",
            "action",
            "resource_type",
            "resource_id",
            "before",
            "after",
            "metadata",
            "request_id",
            "created_at",
        )

    def get_actor_email(self, obj) -> str | None:
        return obj.actor.email if obj.actor else None

    def get_request_id(self, obj) -> str | None:
        if isinstance(obj.metadata, dict):
            request_id = obj.metadata.get("request_id")
            return str(request_id) if request_id else None
        return None
