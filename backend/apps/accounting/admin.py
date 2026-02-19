from django.contrib import admin

from apps.accounting.models import Account, NumberSequence


@admin.register(Account)
class AccountAdmin(admin.ModelAdmin):
    list_display = ("company", "code", "name", "type", "normal_balance", "is_active")
    list_filter = ("type", "normal_balance", "is_active")
    search_fields = ("code", "name")


@admin.register(NumberSequence)
class NumberSequenceAdmin(admin.ModelAdmin):
    list_display = ("company", "key", "next_value", "updated_at")
    search_fields = ("key",)
