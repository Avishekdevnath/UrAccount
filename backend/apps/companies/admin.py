from django.contrib import admin

from apps.companies.models import Company, CompanyInvitation, CompanyMember


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "base_currency", "is_active", "created_at")
    search_fields = ("name", "slug")


@admin.register(CompanyMember)
class CompanyMemberAdmin(admin.ModelAdmin):
    list_display = ("company", "user", "status", "joined_at")
    list_filter = ("status",)


@admin.register(CompanyInvitation)
class CompanyInvitationAdmin(admin.ModelAdmin):
    list_display = ("company", "email", "expires_at", "accepted_at")
    search_fields = ("email",)
