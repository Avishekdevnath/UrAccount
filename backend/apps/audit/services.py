from apps.audit.models import AuditEvent


def log_audit_event(
    *,
    company,
    actor_user,
    action,
    entity_type,
    entity_id=None,
    metadata=None,
    ip_address=None,
    user_agent="",
):
    return AuditEvent.objects.create(
        company=company,
        actor_user=actor_user,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        metadata=metadata or {},
        ip_address=ip_address,
        user_agent=user_agent or "",
    )
