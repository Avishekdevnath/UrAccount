from django.conf import settings
from django.db import models

from apps.common.models import TimeStampedUUIDModel
from apps.companies.models import Company


class Permission(models.Model):
    code = models.CharField(max_length=128, primary_key=True)
    description = models.CharField(max_length=255)

    class Meta:
        db_table = "permission"
        ordering = ["code"]

    def __str__(self):
        return self.code


class CompanyRole(TimeStampedUUIDModel):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="roles")
    name = models.CharField(max_length=100)
    is_system = models.BooleanField(default=False)

    class Meta:
        db_table = "company_role"
        unique_together = (("company", "name"),)
        ordering = ["name"]
        indexes = [models.Index(fields=["company", "name"])]

    def __str__(self):
        return f"{self.company_id}:{self.name}"


class CompanyRolePermission(models.Model):
    role = models.ForeignKey(CompanyRole, on_delete=models.CASCADE, related_name="role_permissions")
    permission = models.ForeignKey(Permission, on_delete=models.RESTRICT, related_name="role_permissions")

    class Meta:
        db_table = "company_role_permission"
        unique_together = (("role", "permission"),)

    def __str__(self):
        return f"{self.role_id}:{self.permission_id}"


class CompanyRoleAssignment(models.Model):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="role_assignments")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="role_assignments")
    role = models.ForeignKey(CompanyRole, on_delete=models.CASCADE, related_name="assignments")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "company_role_assignment"
        unique_together = (("company", "user", "role"),)
        indexes = [models.Index(fields=["company", "user"])]

    def __str__(self):
        return f"{self.company_id}:{self.user_id}:{self.role_id}"
