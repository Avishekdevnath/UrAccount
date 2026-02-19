from rest_framework import serializers

from apps.contacts.models import Contact


class ContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contact
        fields = (
            "id",
            "company",
            "type",
            "name",
            "email",
            "phone",
            "address",
            "tax_id",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")
        extra_kwargs = {"company": {"required": False}}
