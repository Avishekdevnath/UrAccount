from rest_framework import serializers

from apps.users.models import User


class UserMeSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "email", "full_name", "is_active", "is_staff", "is_superuser")
