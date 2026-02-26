from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db import transaction
from rest_framework import generics, permissions, response, status, views
from rest_framework.exceptions import ValidationError

from apps.companies.models import Company, CompanyInvitation, CompanyMember, CompanyMemberStatus
from apps.companies.serializers import (
    CompanyInvitationAcceptSerializer,
    CompanyInvitationCreateSerializer,
    CompanyMemberCreateUserSerializer,
    CompanyMemberRolesUpdateSerializer,
    CompanyMemberResetPasswordSerializer,
    CompanyMemberSerializer,
    CompanyMemberStatusUpdateSerializer,
    CompanySerializer,
)
from apps.companies.services import accept_company_invitation, create_company_for_user
from apps.audit.services import log_audit_event
from apps.rbac.constants import PERMISSION_COMPANY_MANAGE, PERMISSION_MEMBERS_MANAGE, ROLE_OWNER
from apps.rbac.models import CompanyRole, CompanyRoleAssignment
from apps.rbac.services import user_has_company_permission
from apps.users.models import User


def _get_company_for_user(*, user, company_id):
    return get_object_or_404(
        Company,
        id=company_id,
        is_active=True,
        memberships__user=user,
        memberships__status=CompanyMemberStatus.ACTIVE,
    )


def _replace_company_member_roles(*, company: Company, user: User, role_names: list[str]) -> list[str]:
    role_names_set = {name.strip() for name in role_names if name.strip()}
    valid_roles = {role.name: role for role in CompanyRole.objects.filter(company=company, name__in=role_names_set)}
    missing = sorted(role_names_set.difference(valid_roles.keys()))
    if missing:
        raise ValidationError({"detail": f"Unknown company role(s): {', '.join(missing)}"})

    CompanyRoleAssignment.objects.filter(company=company, user=user).exclude(role__name__in=role_names_set).delete()
    for role_name in sorted(role_names_set):
        CompanyRoleAssignment.objects.get_or_create(company=company, user=user, role=valid_roles[role_name])
    return sorted(role_names_set)


def _get_member_role_names(*, company: Company, user: User) -> list[str]:
    return sorted(
        CompanyRoleAssignment.objects.filter(company=company, user=user).values_list("role__name", flat=True)
    )


class CompanyListCreateView(generics.ListCreateAPIView):
    serializer_class = CompanySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Company.objects.filter(
            is_active=True,
            memberships__user=self.request.user,
            memberships__status=CompanyMemberStatus.ACTIVE,
        ).distinct()

    def perform_create(self, serializer):
        self.company = create_company_for_user(user=self.request.user, company_data=serializer.validated_data)
        log_audit_event(
            company=self.company,
            actor_user=self.request.user,
            action="company.create",
            entity_type="company",
            entity_id=self.company.id,
            metadata={"slug": self.company.slug},
            ip_address=getattr(self.request, "META", {}).get("REMOTE_ADDR"),
            user_agent=self.request.headers.get("User-Agent", ""),
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        output = self.get_serializer(self.company)
        headers = self.get_success_headers(output.data)
        return response.Response(output.data, status=status.HTTP_201_CREATED, headers=headers)


class CompanyRetrieveUpdateView(generics.RetrieveUpdateAPIView):
    serializer_class = CompanySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return _get_company_for_user(user=self.request.user, company_id=self.kwargs["company_id"])

    def update(self, request, *args, **kwargs):
        company = self.get_object()
        if not user_has_company_permission(request.user, company, PERMISSION_COMPANY_MANAGE):
            return response.Response({"detail": "Insufficient company permissions."}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)


class CompanyMembersView(generics.ListAPIView):
    serializer_class = CompanyMemberSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        company = _get_company_for_user(user=self.request.user, company_id=self.kwargs["company_id"])
        return CompanyMember.objects.filter(company=company).select_related("user", "company")


class CompanyMemberStatusUpdateView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, company_id, user_id):
        company = _get_company_for_user(user=request.user, company_id=company_id)
        if not user_has_company_permission(request.user, company, PERMISSION_MEMBERS_MANAGE):
            return response.Response({"detail": "Insufficient member permissions."}, status=status.HTTP_403_FORBIDDEN)

        serializer = CompanyMemberStatusUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        membership = get_object_or_404(CompanyMember, company=company, user_id=user_id)
        target_roles = _get_member_role_names(company=company, user=membership.user)
        if ROLE_OWNER in target_roles:
            return response.Response(
                {"detail": "Owner role can only be managed by system admin."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        before_status = membership.status
        membership.status = serializer.validated_data["status"]
        membership.save(update_fields=["status", "updated_at"])
        log_audit_event(
            company=company,
            actor_user=request.user,
            action="member.status.update",
            entity_type="company_member",
            entity_id=membership.id,
            metadata={
                "before_status": before_status,
                "after_status": membership.status,
                "target_user_id": str(membership.user_id),
            },
            ip_address=request.META.get("REMOTE_ADDR"),
            user_agent=request.headers.get("User-Agent", ""),
        )

        return response.Response(CompanyMemberSerializer(membership).data)

    @transaction.atomic
    def delete(self, request, company_id, user_id):
        company = _get_company_for_user(user=request.user, company_id=company_id)
        if not user_has_company_permission(request.user, company, PERMISSION_MEMBERS_MANAGE):
            return response.Response({"detail": "Insufficient member permissions."}, status=status.HTTP_403_FORBIDDEN)

        membership = get_object_or_404(CompanyMember.objects.select_related("user"), company=company, user_id=user_id)
        role_names = _get_member_role_names(company=company, user=membership.user)
        if ROLE_OWNER in role_names:
            return response.Response(
                {"detail": "Owner role can only be managed by system admin."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        before = {"status": membership.status, "roles": role_names}
        membership.status = CompanyMemberStatus.DISABLED
        membership.save(update_fields=["status", "updated_at"])
        CompanyRoleAssignment.objects.filter(company=company, user=membership.user).delete()
        after = {"status": membership.status, "roles": []}

        log_audit_event(
            company=company,
            actor_user=request.user,
            action="member.remove",
            entity_type="company_member",
            entity_id=membership.id,
            metadata={
                "target_user_id": str(membership.user_id),
                "email": membership.user.email,
                "before": before,
                "after": after,
            },
            ip_address=request.META.get("REMOTE_ADDR"),
            user_agent=request.headers.get("User-Agent", ""),
        )

        return response.Response(status=status.HTTP_204_NO_CONTENT)


class CompanyMemberRolesUpdateView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    @transaction.atomic
    def patch(self, request, company_id, user_id):
        company = _get_company_for_user(user=request.user, company_id=company_id)
        if not user_has_company_permission(request.user, company, PERMISSION_MEMBERS_MANAGE):
            return response.Response({"detail": "Insufficient member permissions."}, status=status.HTTP_403_FORBIDDEN)

        membership = get_object_or_404(CompanyMember.objects.select_related("user"), company=company, user_id=user_id)
        before_roles = _get_member_role_names(company=company, user=membership.user)
        if ROLE_OWNER in before_roles:
            return response.Response(
                {"detail": "Owner role can only be managed by system admin."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = CompanyMemberRolesUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        role_names = serializer.validated_data["roles"]

        after_roles = _replace_company_member_roles(company=company, user=membership.user, role_names=role_names)
        log_audit_event(
            company=company,
            actor_user=request.user,
            action="member.roles.replace",
            entity_type="company_member",
            entity_id=membership.id,
            metadata={
                "target_user_id": str(membership.user_id),
                "email": membership.user.email,
                "before_roles": before_roles,
                "after_roles": after_roles,
            },
            ip_address=request.META.get("REMOTE_ADDR"),
            user_agent=request.headers.get("User-Agent", ""),
        )

        return response.Response(
            {
                "company_id": str(company.id),
                "user_id": str(membership.user_id),
                "roles": after_roles,
            }
        )


class CompanyMemberCreateUserView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    @transaction.atomic
    def post(self, request, company_id):
        company = _get_company_for_user(user=request.user, company_id=company_id)
        if not user_has_company_permission(request.user, company, PERMISSION_MEMBERS_MANAGE):
            return response.Response({"detail": "Insufficient member permissions."}, status=status.HTTP_403_FORBIDDEN)

        serializer = CompanyMemberCreateUserSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data

        user = User.objects.create_user(
            email=payload["email"],
            password=payload["password"],
            full_name=payload["full_name"],
        )
        membership = CompanyMember.objects.create(
            company=company,
            user=user,
            status=CompanyMemberStatus.ACTIVE,
        )

        role = get_object_or_404(CompanyRole, company=company, name=payload["role"])
        CompanyRoleAssignment.objects.get_or_create(company=company, user=user, role=role)

        log_audit_event(
            company=company,
            actor_user=request.user,
            action="member.user.create",
            entity_type="company_member",
            entity_id=membership.id,
            metadata={"target_user_id": str(user.id), "email": user.email, "role": role.name},
            ip_address=request.META.get("REMOTE_ADDR"),
            user_agent=request.headers.get("User-Agent", ""),
        )

        data = CompanyMemberSerializer(membership).data
        data["roles"] = [role.name]
        return response.Response(data, status=status.HTTP_201_CREATED)


class CompanyMemberPasswordResetView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, company_id, user_id):
        company = _get_company_for_user(user=request.user, company_id=company_id)
        if not user_has_company_permission(request.user, company, PERMISSION_MEMBERS_MANAGE):
            return response.Response({"detail": "Insufficient member permissions."}, status=status.HTTP_403_FORBIDDEN)

        serializer = CompanyMemberResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        membership = get_object_or_404(CompanyMember.objects.select_related("user"), company=company, user_id=user_id)
        target_user = membership.user
        target_user.set_password(serializer.validated_data["new_password"])
        target_user.save(update_fields=["password", "password_changed_at"])

        log_audit_event(
            company=company,
            actor_user=request.user,
            action="member.password.reset",
            entity_type="company_member",
            entity_id=membership.id,
            metadata={"target_user_id": str(target_user.id), "email": target_user.email},
            ip_address=request.META.get("REMOTE_ADDR"),
            user_agent=request.headers.get("User-Agent", ""),
        )

        return response.Response({"detail": "Member password reset."}, status=status.HTTP_200_OK)


class CompanyInvitationCreateView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, company_id):
        company = _get_company_for_user(user=request.user, company_id=company_id)
        if not user_has_company_permission(request.user, company, PERMISSION_MEMBERS_MANAGE):
            return response.Response({"detail": "Insufficient member permissions."}, status=status.HTTP_403_FORBIDDEN)

        serializer = CompanyInvitationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        invitation, _ = CompanyInvitation.objects.update_or_create(
            company=company,
            email=serializer.validated_data["email"],
            defaults={
                "invited_by_user": request.user,
                "expires_at": serializer.validated_data["expires_at"],
                "accepted_at": None,
            },
        )
        log_audit_event(
            company=company,
            actor_user=request.user,
            action="member.invite.create",
            entity_type="company_invitation",
            entity_id=invitation.id,
            metadata={"email": invitation.email, "expires_at": invitation.expires_at.isoformat()},
            ip_address=request.META.get("REMOTE_ADDR"),
            user_agent=request.headers.get("User-Agent", ""),
        )

        return response.Response(
            {
                "id": str(invitation.id),
                "email": invitation.email,
                "token": str(invitation.token),
                "expires_at": invitation.expires_at,
            },
            status=status.HTTP_201_CREATED,
        )


class CompanyInvitationAcceptView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = CompanyInvitationAcceptSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        invitation = get_object_or_404(CompanyInvitation, token=serializer.validated_data["token"])
        if invitation.expires_at <= timezone.now():
            return response.Response({"detail": "Invitation expired."}, status=status.HTTP_400_BAD_REQUEST)

        if invitation.email.lower() != request.user.email.lower():
            return response.Response({"detail": "Invitation email mismatch."}, status=status.HTTP_403_FORBIDDEN)

        accept_company_invitation(invitation=invitation, user=request.user)
        log_audit_event(
            company=invitation.company,
            actor_user=request.user,
            action="member.invite.accept",
            entity_type="company_invitation",
            entity_id=invitation.id,
            metadata={"email": invitation.email},
            ip_address=request.META.get("REMOTE_ADDR"),
            user_agent=request.headers.get("User-Agent", ""),
        )
        return response.Response({"detail": "Invitation accepted."})
