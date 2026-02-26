from django.urls import path

from apps.system_admin.views import (
    SystemAuditLogListView,
    SystemCompanyBootstrapView,
    SystemCompanyDetailView,
    SystemCompanyFeatureFlagsView,
    SystemCompanyListView,
    SystemCompanyMemberRemoveView,
    SystemCompanyMemberRolesView,
    SystemCompanyMemberUpsertView,
    SystemCompanyQuotasView,
    SystemCompanyStatusView,
    SystemFeatureFlagsView,
    SystemHealthView,
    SystemUserDetailView,
    SystemUserListView,
    SystemUserResetPasswordView,
    SystemUserRoleView,
)

urlpatterns = [
    path("health/", SystemHealthView.as_view(), name="system-health"),
    path("companies/bootstrap/", SystemCompanyBootstrapView.as_view(), name="system-companies-bootstrap"),
    path("companies/", SystemCompanyListView.as_view(), name="system-companies-list"),
    path("companies/<uuid:company_id>/", SystemCompanyDetailView.as_view(), name="system-companies-detail"),
    path(
        "companies/<uuid:company_id>/feature-flags/",
        SystemCompanyFeatureFlagsView.as_view(),
        name="system-company-feature-flags",
    ),
    path(
        "companies/<uuid:company_id>/quotas/",
        SystemCompanyQuotasView.as_view(),
        name="system-company-quotas",
    ),
    path(
        "companies/<uuid:company_id>/status/",
        SystemCompanyStatusView.as_view(),
        name="system-company-status",
    ),
    path(
        "companies/<uuid:company_id>/members/",
        SystemCompanyMemberUpsertView.as_view(),
        name="system-company-members-upsert",
    ),
    path(
        "companies/<uuid:company_id>/members/<uuid:user_id>/roles/",
        SystemCompanyMemberRolesView.as_view(),
        name="system-company-member-roles",
    ),
    path(
        "companies/<uuid:company_id>/members/<uuid:user_id>/",
        SystemCompanyMemberRemoveView.as_view(),
        name="system-company-member-remove",
    ),
    path("users/", SystemUserListView.as_view(), name="system-users-list"),
    path("users/<uuid:user_id>/", SystemUserDetailView.as_view(), name="system-users-detail"),
    path(
        "users/<uuid:user_id>/reset-password/",
        SystemUserResetPasswordView.as_view(),
        name="system-user-reset-password",
    ),
    path(
        "users/<uuid:user_id>/system-role/",
        SystemUserRoleView.as_view(),
        name="system-user-role",
    ),
    path("audit-logs/", SystemAuditLogListView.as_view(), name="system-audit-logs"),
    path("feature-flags/", SystemFeatureFlagsView.as_view(), name="system-feature-flags"),
]
