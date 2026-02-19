import uuid

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone

from apps.common.models import TimeStampedUUIDModel


class Company(TimeStampedUUIDModel):
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True)
    base_currency = models.CharField(max_length=3, default="USD")
    timezone = models.CharField(max_length=128, default="UTC")
    fiscal_year_start_month = models.PositiveSmallIntegerField(
        default=1,
        validators=[MinValueValidator(1), MaxValueValidator(12)],
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "company"
        ordering = ["name"]

    def __str__(self):
        return self.name


class CompanyMemberStatus(models.TextChoices):
    ACTIVE = "active", "Active"
    INVITED = "invited", "Invited"
    DISABLED = "disabled", "Disabled"


class CompanyMember(TimeStampedUUIDModel):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="memberships")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="company_memberships")
    status = models.CharField(max_length=20, choices=CompanyMemberStatus.choices, default=CompanyMemberStatus.ACTIVE)
    joined_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "company_member"
        unique_together = (("company", "user"),)
        indexes = [
            models.Index(fields=["company"]),
            models.Index(fields=["user"]),
        ]

    def __str__(self):
        return f"{self.company_id}:{self.user_id}"


class CompanyInvitation(TimeStampedUUIDModel):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="invitations")
    email = models.EmailField()
    invited_by_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sent_company_invitations",
    )
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    expires_at = models.DateTimeField()
    accepted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "company_invitation"
        unique_together = (("company", "email"),)
        indexes = [
            models.Index(fields=["company"]),
            models.Index(fields=["token"]),
        ]

    def __str__(self):
        return f"{self.company_id}:{self.email}"
