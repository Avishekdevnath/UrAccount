from django.contrib import admin

from apps.journals.models import JournalEntry, JournalLine


class JournalLineInline(admin.TabularInline):
    model = JournalLine
    extra = 0


@admin.register(JournalEntry)
class JournalEntryAdmin(admin.ModelAdmin):
    list_display = ("company", "entry_no", "status", "entry_date", "posted_at", "voided_at")
    list_filter = ("status",)
    inlines = [JournalLineInline]


@admin.register(JournalLine)
class JournalLineAdmin(admin.ModelAdmin):
    list_display = ("company", "journal_entry", "line_no", "account", "debit", "credit")
