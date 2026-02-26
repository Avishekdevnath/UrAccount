from django.db import transaction

from apps.companies.services import create_company_for_user
from apps.system_admin.models import SystemAuditLog, SystemCompanyConfig
from apps.users.models import User


SENSITIVE_KEYS = {
    "password",
    "new_password",
    "old_password",
    "token",
    "refresh",
    "access",
    "secret",
    "api_key",
    "authorization",
    "cookie",
}


def _sanitize_for_audit(value):
    if isinstance(value, dict):
        redacted = {}
        for key, item in value.items():
            normalized = str(key).strip().lower()
            if normalized in SENSITIVE_KEYS:
                redacted[key] = "***REDACTED***"
            else:
                redacted[key] = _sanitize_for_audit(item)
        return redacted
    if isinstance(value, list):
        return [_sanitize_for_audit(item) for item in value]
    return value


def request_client_ip(request) -> str | None:
    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def log_system_audit_event(
    *,
    request,
    actor_user,
    action: str,
    resource_type: str,
    resource_id: str,
    before=None,
    after=None,
    metadata=None,
) -> SystemAuditLog:
    payload = _sanitize_for_audit(metadata.copy()) if isinstance(metadata, dict) else {}
    request_id = getattr(request, "request_id", None)
    if request_id:
        payload["request_id"] = request_id

    return SystemAuditLog.objects.create(
        actor=actor_user,
        ip_address=request_client_ip(request),
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        before=_sanitize_for_audit(before),
        after=_sanitize_for_audit(after),
        metadata=payload,
    )


@transaction.atomic
def bootstrap_company_with_owner(
    *,
    company_data: dict,
    owner_data: dict,
):
    owner_email = owner_data["email"].strip().lower()
    owner = User.objects.filter(email__iexact=owner_email).first()
    owner_created = False

    if owner is None:
        owner = User.objects.create_user(
            email=owner_email,
            password=owner_data["password"],
            full_name=owner_data["full_name"].strip(),
        )
        owner_created = True

    company = create_company_for_user(user=owner, company_data=company_data)
    SystemCompanyConfig.objects.get_or_create(company=company)

    return {
        "company": company,
        "owner": owner,
        "owner_created": owner_created,
    }
