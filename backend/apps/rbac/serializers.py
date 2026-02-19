from rest_framework import serializers

from apps.rbac.models import CompanyRole, CompanyRoleAssignment, Permission


class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = ("code", "description")


class CompanyRoleSerializer(serializers.ModelSerializer):
    permissions = serializers.SlugRelatedField(
        many=True,
        read_only=True,
        source="role_permissions",
        slug_field="permission_id",
    )

    class Meta:
        model = CompanyRole
        fields = ("id", "company", "name", "is_system", "permissions")


class CompanyRoleAssignSerializer(serializers.Serializer):
    user_id = serializers.UUIDField()
    role_id = serializers.UUIDField()


class CompanyRoleAssignmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompanyRoleAssignment
        fields = ("company", "user", "role", "created_at")
