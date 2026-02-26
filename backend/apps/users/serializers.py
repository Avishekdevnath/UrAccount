from rest_framework import serializers

from apps.users.models import User


class UserMeSerializer(serializers.ModelSerializer):
    system_role = serializers.SerializerMethodField()
    system_role_active = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "full_name",
            "is_active",
            "is_staff",
            "is_superuser",
            "system_role",
            "system_role_active",
        )

    def get_system_role(self, obj) -> str | None:
        role = getattr(obj, "system_role", None)
        return role.role if role else None

    def get_system_role_active(self, obj) -> bool | None:
        role = getattr(obj, "system_role", None)
        return role.is_active if role else None
