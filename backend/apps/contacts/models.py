from django.db import models

from apps.common.models import TimeStampedUUIDModel
from apps.companies.models import Company


class ContactType(models.TextChoices):
    CUSTOMER = "customer", "Customer"
    VENDOR = "vendor", "Vendor"
    BOTH = "both", "Both"


class Contact(TimeStampedUUIDModel):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="contacts")
    type = models.CharField(max_length=20, choices=ContactType.choices, default=ContactType.BOTH)
    name = models.CharField(max_length=255)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=64, blank=True)
    address = models.TextField(blank=True)
    tax_id = models.CharField(max_length=64, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "contact"
        indexes = [models.Index(fields=["company", "type"])]
        ordering = ["name"]

    def __str__(self):
        return f"{self.company_id}:{self.name}"
