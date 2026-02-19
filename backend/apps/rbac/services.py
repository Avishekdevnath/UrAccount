from apps.companies.models import Company
from apps.rbac.constants import DEFAULT_ROLE_PERMISSIONS, ROLE_OWNER
from apps.rbac.models import CompanyRole, CompanyRoleAssignment, CompanyRolePermission, Permission


def ensure_default_permissions():
    for code in sorted({perm for perms in DEFAULT_ROLE_PERMISSIONS.values() for perm in perms}):
        Permission.objects.get_or_create(
            code=code,
            defaults={"description": code.replace(".", " ").title()},
        )


def ensure_default_roles_for_company(company: Company):
    ensure_default_permissions()

    for role_name, permission_codes in DEFAULT_ROLE_PERMISSIONS.items():
        role, _ = CompanyRole.objects.get_or_create(
            company=company,
            name=role_name,
            defaults={"is_system": True},
        )
        for code in permission_codes:
            permission = Permission.objects.get(code=code)
            CompanyRolePermission.objects.get_or_create(role=role, permission=permission)


def assign_owner_role(company: Company, user):
    owner_role = CompanyRole.objects.get(company=company, name=ROLE_OWNER)
    CompanyRoleAssignment.objects.get_or_create(company=company, user=user, role=owner_role)


def user_has_company_permission(user, company: Company, permission_code: str) -> bool:
    if not user.is_authenticated:
        return False

    return CompanyRoleAssignment.objects.filter(
        company=company,
        user=user,
        role__role_permissions__permission__code=permission_code,
    ).exists()


def get_user_roles_and_permissions(*, user, company: Company):
    assignments = CompanyRoleAssignment.objects.filter(
        company=company,
        user=user,
    ).select_related("role")

    role_names = sorted({assignment.role.name for assignment in assignments})
    permission_codes = sorted(
        {
            role_permission.permission.code
            for assignment in assignments
            for role_permission in assignment.role.role_permissions.select_related("permission").all()
        }
    )
    return role_names, permission_codes
