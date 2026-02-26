from django.utils import timezone
from rest_framework import serializers

from apps.companies.models import Company, CompanyInvitation, CompanyMember, CompanyMemberStatus
from apps.rbac.constants import ROLE_ACCOUNTANT, ROLE_ADMIN, ROLE_VIEWER
from apps.rbac.models import CompanyRole
from apps.users.models import User


class CompanySerializer(serializers.ModelSerializer):
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
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at")


class CompanyMemberSerializer(serializers.ModelSerializer):
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
            "roles",
        )
        read_only_fields = ("id", "company", "joined_at", "created_at", "user_email", "user_full_name", "roles")

    def get_roles(self, obj: CompanyMember) -> list[str]:
        roles = CompanyRole.objects.filter(
            assignments__company=obj.company,
            assignments__user=obj.user,
        ).values_list("name", flat=True)
        return sorted(set(roles))


class CompanyInvitationCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompanyInvitation
        fields = ("email", "expires_at")

    def validate_expires_at(self, value):
        if value <= timezone.now():
            raise serializers.ValidationError("expires_at must be in the future")
        return value


class CompanyInvitationAcceptSerializer(serializers.Serializer):
    token = serializers.UUIDField()


class CompanyMemberStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=CompanyMemberStatus.choices)


class CompanyMemberCreateUserSerializer(serializers.Serializer):
    email = serializers.EmailField()
    full_name = serializers.CharField(max_length=255)
    password = serializers.CharField(write_only=True, min_length=8)
    role = serializers.ChoiceField(choices=[ROLE_ADMIN, ROLE_ACCOUNTANT, ROLE_VIEWER], default=ROLE_VIEWER)

    def validate_email(self, value: str) -> str:
        email = value.strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return email


class CompanyMemberResetPasswordSerializer(serializers.Serializer):
    new_password = serializers.CharField(write_only=True, min_length=8)


class CompanyMemberRolesUpdateSerializer(serializers.Serializer):
    roles = serializers.ListField(
        child=serializers.ChoiceField(choices=[ROLE_ADMIN, ROLE_ACCOUNTANT, ROLE_VIEWER]),
        allow_empty=False,
    )

    def validate_roles(self, value: list[str]) -> list[str]:
        deduped = []
        seen = set()
        for role in value:
            if role not in seen:
                deduped.append(role)
                seen.add(role)
        return deduped
