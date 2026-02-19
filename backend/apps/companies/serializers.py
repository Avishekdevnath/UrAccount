from django.utils import timezone
from rest_framework import serializers

from apps.companies.models import Company, CompanyInvitation, CompanyMember, CompanyMemberStatus


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

    class Meta:
        model = CompanyMember
        fields = ("id", "company", "user", "user_email", "user_full_name", "status", "joined_at", "created_at")
        read_only_fields = ("id", "company", "joined_at", "created_at", "user_email", "user_full_name")


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
