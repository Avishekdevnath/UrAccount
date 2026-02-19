from django.contrib import admin

from apps.rbac.models import CompanyRole, CompanyRoleAssignment, CompanyRolePermission, Permission


@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    list_display = ("code", "description")
    search_fields = ("code",)


@admin.register(CompanyRole)
class CompanyRoleAdmin(admin.ModelAdmin):
    list_display = ("company", "name", "is_system", "created_at")
    list_filter = ("is_system",)
    search_fields = ("name",)


@admin.register(CompanyRolePermission)
class CompanyRolePermissionAdmin(admin.ModelAdmin):
    list_display = ("role", "permission")


@admin.register(CompanyRoleAssignment)
class CompanyRoleAssignmentAdmin(admin.ModelAdmin):
    list_display = ("company", "user", "role", "created_at")
