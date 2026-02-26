from django.conf import settings
from django.db import models

from apps.companies.models import Company
from apps.common.models import TimeStampedUUIDModel


class SystemRole(TimeStampedUUIDModel):
    ROLE_SUPER_ADMIN = "SUPER_ADMIN"
    ROLE_SUPPORT = "SUPPORT"

    ROLE_CHOICES = (
        (ROLE_SUPER_ADMIN, "Super Admin"),
        (ROLE_SUPPORT, "Support"),
    )

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        related_name="system_role",
        on_delete=models.CASCADE,
    )
    role = models.CharField(max_length=32, choices=ROLE_CHOICES)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "system_role"
        verbose_name = "System Role"
        verbose_name_plural = "System Roles"

    def __str__(self) -> str:
        return f"{self.user.email} ({self.role})"


class SystemAuditLog(TimeStampedUUIDModel):
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="system_audit_events",
    )
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    action = models.CharField(max_length=128)
    resource_type = models.CharField(max_length=64)
    resource_id = models.CharField(max_length=64)
    before = models.JSONField(null=True, blank=True)
    after = models.JSONField(null=True, blank=True)
    metadata = models.JSONField(null=True, blank=True)

    class Meta:
        db_table = "system_audit_log"
        ordering = ["-created_at"]
        verbose_name = "System Audit Log"
        verbose_name_plural = "System Audit Logs"

    def __str__(self) -> str:
        return f"{self.action} {self.resource_type}:{self.resource_id}"


class SystemCompanyConfig(TimeStampedUUIDModel):
    company = models.OneToOneField(
        Company,
        related_name="system_config",
        on_delete=models.CASCADE,
    )
    ai_enabled = models.BooleanField(default=False)
    ai_suggestions_enabled = models.BooleanField(default=False)
    ai_rag_enabled = models.BooleanField(default=False)
    max_users = models.PositiveIntegerField(null=True, blank=True)
    max_storage_mb = models.PositiveIntegerField(null=True, blank=True)
    max_api_requests_per_minute = models.PositiveIntegerField(null=True, blank=True)
    extra_flags = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "system_company_config"
        verbose_name = "System Company Config"
        verbose_name_plural = "System Company Configs"

    def __str__(self) -> str:
        return f"{self.company.slug} config"
