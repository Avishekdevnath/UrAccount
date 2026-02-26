from django.conf import settings


def is_system_admin_request(user) -> bool:
    if not getattr(settings, "SYSTEM_ADMIN_ENABLED", False):
        return False
    if not user or not user.is_authenticated:
        return False
    role = getattr(user, "system_role", None)
    if not role or not role.is_active:
        return False
    return role.role in {"SUPER_ADMIN", "SUPPORT"}


def is_system_super_admin_request(user) -> bool:
    if not getattr(settings, "SYSTEM_ADMIN_ENABLED", False):
        return False
    if not user or not user.is_authenticated:
        return False
    role = getattr(user, "system_role", None)
    if not role or not role.is_active:
        return False
    return role.role == "SUPER_ADMIN"
