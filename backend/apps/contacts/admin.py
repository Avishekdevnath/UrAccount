from django.contrib import admin

from apps.contacts.models import Contact


@admin.register(Contact)
class ContactAdmin(admin.ModelAdmin):
    list_display = ("company", "name", "type", "email", "is_active")
    list_filter = ("type", "is_active")
    search_fields = ("name", "email")
