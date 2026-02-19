import json

from django.utils import timezone

from apps.idempotency.models import IdempotencyRecord, IdempotencyStatus


def get_valid_idempotency_record(*, company, scope, idempotency_key):
    return IdempotencyRecord.objects.filter(
        company=company,
        scope=scope,
        idempotency_key=idempotency_key,
        expires_at__gt=timezone.now(),
    ).first()


def create_or_update_idempotency_record(
    *,
    company,
    scope,
    idempotency_key,
    request_hash,
    expires_at,
    status=IdempotencyStatus.IN_PROGRESS,
    response_body=None,
):
    serializable_body = None
    if response_body is not None:
        serializable_body = json.loads(json.dumps(response_body, default=str))

    record, _ = IdempotencyRecord.objects.update_or_create(
        company=company,
        scope=scope,
        idempotency_key=idempotency_key,
        defaults={
            "request_hash": request_hash,
            "expires_at": expires_at,
            "status": status,
            "response_body": serializable_body,
        },
    )
    return record
