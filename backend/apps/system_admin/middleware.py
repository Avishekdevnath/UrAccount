import logging

from apps.system_admin.models import SystemAuditLog

logger = logging.getLogger(__name__)


class SystemAdminErrorAuditMiddleware:
    """
    Emit an audit event for 5xx responses on system-admin API endpoints.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        path = str(getattr(request, "path", "") or "")

        if not path.startswith("/api/v1/system/"):
            return response
        if response.status_code < 500:
            return response

        user = getattr(request, "user", None)
        actor = user if getattr(user, "is_authenticated", False) else None
        metadata = {
            "status_code": int(response.status_code),
            "method": getattr(request, "method", None),
            "path": path,
        }
        request_id = getattr(request, "request_id", None)
        if request_id:
            metadata["request_id"] = request_id

        try:
            SystemAuditLog.objects.create(
                actor=actor,
                ip_address=request.META.get("REMOTE_ADDR"),
                action="system.response.error",
                resource_type="system_endpoint",
                resource_id=path[:64] or "/",
                metadata=metadata,
            )
        except Exception:
            logger.exception("Failed to persist system error-response audit event.")

        return response
