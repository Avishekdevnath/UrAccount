from django.contrib import admin

from apps.idempotency.models import IdempotencyRecord


@admin.register(IdempotencyRecord)
class IdempotencyRecordAdmin(admin.ModelAdmin):
    list_display = ("company", "scope", "idempotency_key", "status", "expires_at", "created_at")
    list_filter = ("status",)
