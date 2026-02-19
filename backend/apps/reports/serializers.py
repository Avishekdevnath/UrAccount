from datetime import timedelta

from django.utils import timezone
from rest_framework import serializers


class DateRangeQuerySerializer(serializers.Serializer):
    start_date = serializers.DateField(required=False)
    end_date = serializers.DateField(required=False)

    def validate(self, attrs):
        start_date = attrs.get("start_date")
        end_date = attrs.get("end_date")
        if start_date and end_date and start_date > end_date:
            raise serializers.ValidationError({"end_date": "end_date must be greater than or equal to start_date."})
        if start_date and end_date and (end_date - start_date).days > 366:
            raise serializers.ValidationError({"end_date": "Maximum date range is 366 days."})
        if not start_date and not end_date:
            attrs["end_date"] = timezone.now().date()
            attrs["start_date"] = attrs["end_date"] - timedelta(days=30)
        elif start_date and not end_date:
            attrs["end_date"] = start_date + timedelta(days=30)
        elif end_date and not start_date:
            attrs["start_date"] = end_date - timedelta(days=30)
        return attrs


class BalanceSheetQuerySerializer(serializers.Serializer):
    as_of = serializers.DateField(required=False)


class GeneralLedgerQuerySerializer(DateRangeQuerySerializer):
    account_id = serializers.UUIDField(required=False)
    limit = serializers.IntegerField(required=False, min_value=1, max_value=500, default=200)
