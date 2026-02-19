from django.urls import path

from apps.rbac.views import CompanyRoleAssignView, CompanyRoleListView, MyCompanyPermissionsView, PermissionListView

urlpatterns = [
    path("permissions/", PermissionListView.as_view(), name="permission_list"),
    path("companies/<uuid:company_id>/roles/", CompanyRoleListView.as_view(), name="company_role_list"),
    path("companies/<uuid:company_id>/roles/assign/", CompanyRoleAssignView.as_view(), name="company_role_assign"),
    path("companies/<uuid:company_id>/me/", MyCompanyPermissionsView.as_view(), name="company_my_permissions"),
]
