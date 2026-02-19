from django.urls import path

from apps.companies.views import (
    CompanyInvitationAcceptView,
    CompanyInvitationCreateView,
    CompanyListCreateView,
    CompanyMemberStatusUpdateView,
    CompanyMembersView,
    CompanyRetrieveUpdateView,
)

urlpatterns = [
    path("", CompanyListCreateView.as_view(), name="company_list_create"),
    path("<uuid:company_id>/", CompanyRetrieveUpdateView.as_view(), name="company_detail"),
    path("<uuid:company_id>/members/", CompanyMembersView.as_view(), name="company_members"),
    path("<uuid:company_id>/members/<uuid:user_id>/", CompanyMemberStatusUpdateView.as_view(), name="company_member_update"),
    path("<uuid:company_id>/members/invite/", CompanyInvitationCreateView.as_view(), name="company_invite_create"),
    path("members/invite/accept/", CompanyInvitationAcceptView.as_view(), name="company_invite_accept"),
]
