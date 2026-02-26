from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, response, status, views

from apps.companies.models import Company, CompanyMember, CompanyMemberStatus
from apps.rbac.constants import PERMISSION_RBAC_MANAGE
from apps.rbac.models import CompanyRole, CompanyRoleAssignment, Permission
from apps.rbac.serializers import (
    CompanyRoleAssignSerializer,
    CompanyRoleAssignmentSerializer,
    CompanyRoleSerializer,
    PermissionSerializer,
)
from apps.rbac.services import user_has_company_permission
from apps.rbac.services import get_user_roles_and_permissions


def _get_member_company(*, user, company_id):
    return get_object_or_404(
        Company,
        id=company_id,
        is_active=True,
        memberships__user=user,
        memberships__status=CompanyMemberStatus.ACTIVE,
    )


class PermissionListView(generics.ListAPIView):
    serializer_class = PermissionSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = Permission.objects.all()


class CompanyRoleListView(generics.ListAPIView):
    serializer_class = CompanyRoleSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        company = _get_member_company(user=self.request.user, company_id=self.kwargs["company_id"])
        return CompanyRole.objects.filter(company=company).prefetch_related("role_permissions")


class CompanyRoleAssignView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, company_id):
        company = _get_member_company(user=request.user, company_id=company_id)
        if not user_has_company_permission(request.user, company, PERMISSION_RBAC_MANAGE):
            return response.Response({"detail": "Insufficient RBAC permissions."}, status=status.HTTP_403_FORBIDDEN)

        serializer = CompanyRoleAssignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        role = get_object_or_404(CompanyRole, id=serializer.validated_data["role_id"], company=company)
        membership_exists = CompanyMember.objects.filter(
            company=company,
            user_id=serializer.validated_data["user_id"],
            status=CompanyMemberStatus.ACTIVE,
        ).exists()
        if not membership_exists:
            return response.Response({"detail": "User is not an active company member."}, status=status.HTTP_400_BAD_REQUEST)

        assignment, _ = CompanyRoleAssignment.objects.get_or_create(
            company=company,
            user_id=serializer.validated_data["user_id"],
            role=role,
        )
        return response.Response(CompanyRoleAssignmentSerializer(assignment).data, status=status.HTTP_201_CREATED)


class MyCompanyPermissionsView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, company_id):
        company = _get_member_company(user=request.user, company_id=company_id)
        roles, permissions_list = get_user_roles_and_permissions(user=request.user, company=company)
        return response.Response(
            {
                "company_id": str(company.id),
                "roles": roles,
                "permissions": permissions_list,
            }
        )
