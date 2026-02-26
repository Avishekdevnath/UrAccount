from rest_framework import permissions

from apps.companies.models import CompanyMember, CompanyMemberStatus
from apps.rbac.services import user_has_company_permission


class IsCompanyMember(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if not getattr(obj, "is_active", False):
            return False
        return CompanyMember.objects.filter(
            company=obj,
            user=request.user,
            status=CompanyMemberStatus.ACTIVE,
        ).exists()


class HasCompanyPermission(permissions.BasePermission):
    required_permission = None

    def has_object_permission(self, request, view, obj):
        if not self.required_permission:
            return False
        return user_has_company_permission(request.user, obj, self.required_permission)
