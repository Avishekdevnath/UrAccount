from django.shortcuts import get_object_or_404

from apps.companies.models import Company, CompanyMemberStatus
from apps.rbac.services import user_has_company_permission


def get_company_for_user_or_404(*, user, company_id):
    return get_object_or_404(
        Company,
        id=company_id,
        memberships__user=user,
        memberships__status=CompanyMemberStatus.ACTIVE,
    )


def user_has_permission_in_company(*, user, company, permission_code):
    return user_has_company_permission(user, company, permission_code)
