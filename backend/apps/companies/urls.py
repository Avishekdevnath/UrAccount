from django.urls import path

from apps.companies.views import (
    CompanyInvitationAcceptView,
    CompanyInvitationCreateView,
    CompanyListCreateView,
    CompanyMemberCreateUserView,
    CompanyMemberPasswordResetView,
    CompanyMemberRolesUpdateView,
    CompanyMemberStatusUpdateView,
    CompanyMembersView,
    CompanyRetrieveUpdateView,
)

urlpatterns = [
    path("", CompanyListCreateView.as_view(), name="company_list_create"),
    path("<uuid:company_id>/", CompanyRetrieveUpdateView.as_view(), name="company_detail"),
    path("<uuid:company_id>/members/", CompanyMembersView.as_view(), name="company_members"),
    path(
        "<uuid:company_id>/members/create-user/",
        CompanyMemberCreateUserView.as_view(),
        name="company_member_create_user",
    ),
    path("<uuid:company_id>/members/<uuid:user_id>/", CompanyMemberStatusUpdateView.as_view(), name="company_member_update"),
    path(
        "<uuid:company_id>/members/<uuid:user_id>/roles/",
        CompanyMemberRolesUpdateView.as_view(),
        name="company_member_roles_update",
    ),
    path(
        "<uuid:company_id>/members/<uuid:user_id>/reset-password/",
        CompanyMemberPasswordResetView.as_view(),
        name="company_member_password_reset",
    ),
    path("<uuid:company_id>/members/invite/", CompanyInvitationCreateView.as_view(), name="company_invite_create"),
    path("members/invite/accept/", CompanyInvitationAcceptView.as_view(), name="company_invite_accept"),
]
