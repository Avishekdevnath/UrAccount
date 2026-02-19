from django.db import transaction
from django.utils import timezone

from apps.companies.models import Company, CompanyInvitation, CompanyMember, CompanyMemberStatus
from apps.rbac.services import assign_owner_role, ensure_default_roles_for_company


@transaction.atomic
def create_company_for_user(*, user, company_data):
    company = Company.objects.create(**company_data)
    CompanyMember.objects.create(
        company=company,
        user=user,
        status=CompanyMemberStatus.ACTIVE,
    )
    ensure_default_roles_for_company(company)
    assign_owner_role(company, user)
    return company


@transaction.atomic
def accept_company_invitation(*, invitation: CompanyInvitation, user):
    CompanyMember.objects.update_or_create(
        company=invitation.company,
        user=user,
        defaults={"status": CompanyMemberStatus.ACTIVE},
    )
    invitation.accepted_at = invitation.accepted_at or timezone.now()
    invitation.save(update_fields=["accepted_at"])
