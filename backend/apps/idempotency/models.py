from django.db import models

from apps.common.models import TimeStampedUUIDModel
from apps.companies.models import Company


class IdempotencyStatus(models.TextChoices):
    COMPLETED = "completed", "Completed"
    IN_PROGRESS = "in_progress", "In Progress"
    FAILED = "failed", "Failed"


class IdempotencyRecord(TimeStampedUUIDModel):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="idempotency_records")
    scope = models.CharField(max_length=120)
    idempotency_key = models.CharField(max_length=255)
    request_hash = models.CharField(max_length=128)
    status = models.CharField(max_length=20, choices=IdempotencyStatus.choices, default=IdempotencyStatus.COMPLETED)
    response_body = models.JSONField(null=True, blank=True)
    expires_at = models.DateTimeField()

    class Meta:
        db_table = "idempotency_record"
        unique_together = (("company", "scope", "idempotency_key"),)
        indexes = [models.Index(fields=["company", "scope"])]

    def __str__(self):
        return f"{self.company_id}:{self.scope}:{self.idempotency_key}"
