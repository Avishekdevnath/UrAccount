import logging

from rest_framework.permissions import BasePermission

from apps.system_admin.models import SystemAuditLog
from apps.system_admin.utils import is_system_admin_request, is_system_super_admin_request

logger = logging.getLogger(__name__)


def _log_access_denied(request, *, required: str) -> None:
    user = getattr(request, "user", None)
    actor = user if getattr(user, "is_authenticated", False) else None
    path = str(getattr(request, "path", "") or "/")[:64]
    metadata = {
        "required": required,
        "method": getattr(request, "method", None),
        "path": getattr(request, "path", None),
    }
    request_id = getattr(request, "request_id", None)
    if request_id:
        metadata["request_id"] = request_id

    ip_address = request.META.get("REMOTE_ADDR")
    try:
        SystemAuditLog.objects.create(
            actor=actor,
            ip_address=ip_address,
            action="system.access.denied",
            resource_type="system_endpoint",
            resource_id=path,
            metadata=metadata,
        )
    except Exception:
        logger.exception("Failed to persist denied system-access audit event.")


class IsSystemAdmin(BasePermission):
    """
    Allows access only to users with a system role and when the system admin surface is enabled.
    """

    def has_permission(self, request, view) -> bool:
        allowed = is_system_admin_request(request.user)
        if not allowed:
            _log_access_denied(request, required="SYSTEM_ADMIN")
        return allowed


class IsSystemSuperAdmin(BasePermission):
    """
    Allows access only to active SUPER_ADMIN system users.
    """

    def has_permission(self, request, view) -> bool:
        allowed = is_system_super_admin_request(request.user)
        if not allowed:
            _log_access_denied(request, required="SUPER_ADMIN")
        return allowed
