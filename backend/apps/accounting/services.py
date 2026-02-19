from django.db import transaction

from apps.accounting.models import NumberSequence
from apps.companies.models import Company


@transaction.atomic
def get_next_sequence_value(*, company: Company, key: str) -> int:
    sequence, _ = NumberSequence.objects.select_for_update().get_or_create(
        company=company,
        key=key,
        defaults={"next_value": 1},
    )
    next_value = sequence.next_value
    sequence.next_value = next_value + 1
    sequence.save(update_fields=["next_value", "updated_at"])
    return next_value
