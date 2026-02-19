from django.contrib import admin

from apps.audit.models import AuditEvent


@admin.register(AuditEvent)
class AuditEventAdmin(admin.ModelAdmin):
    list_display = ("company", "action", "entity_type", "entity_id", "created_at")
    list_filter = ("action", "entity_type")
