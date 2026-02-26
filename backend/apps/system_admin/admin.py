from django.contrib import admin

from apps.system_admin.models import SystemAuditLog, SystemCompanyConfig, SystemRole


@admin.register(SystemRole)
class SystemRoleAdmin(admin.ModelAdmin):
    list_display = ("user", "role", "is_active", "created_at")
    list_filter = ("role", "is_active")
    search_fields = ("user__email", "user__full_name")


@admin.register(SystemAuditLog)
class SystemAuditLogAdmin(admin.ModelAdmin):
    list_display = ("action", "resource_type", "resource_id", "actor", "created_at")
    list_filter = ("action", "resource_type")
    search_fields = ("action", "resource_type", "resource_id", "actor__email")
    readonly_fields = ("created_at", "updated_at")


@admin.register(SystemCompanyConfig)
class SystemCompanyConfigAdmin(admin.ModelAdmin):
    list_display = (
        "company",
        "ai_enabled",
        "ai_suggestions_enabled",
        "ai_rag_enabled",
        "max_users",
        "max_storage_mb",
        "max_api_requests_per_minute",
        "updated_at",
    )
    search_fields = ("company__name", "company__slug")
