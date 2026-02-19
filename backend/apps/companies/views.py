from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, permissions, response, status, views

from apps.companies.models import Company, CompanyInvitation, CompanyMember, CompanyMemberStatus
from apps.companies.serializers import (
    CompanyInvitationAcceptSerializer,
    CompanyInvitationCreateSerializer,
    CompanyMemberSerializer,
    CompanyMemberStatusUpdateSerializer,
    CompanySerializer,
)
from apps.companies.services import accept_company_invitation, create_company_for_user
from apps.audit.services import log_audit_event
from apps.rbac.constants import PERMISSION_COMPANY_MANAGE, PERMISSION_MEMBERS_MANAGE
from apps.rbac.services import user_has_company_permission


def _get_company_for_user(*, user, company_id):
    return get_object_or_404(
        Company,
        id=company_id,
        memberships__user=user,
        memberships__status=CompanyMemberStatus.ACTIVE,
    )


class CompanyListCreateView(generics.ListCreateAPIView):
    serializer_class = CompanySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Company.objects.filter(
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
        membership.status = serializer.validated_data["status"]
        membership.save(update_fields=["status", "updated_at"])
        log_audit_event(
            company=company,
            actor_user=request.user,
            action="member.status.update",
            entity_type="company_member",
            entity_id=membership.id,
            metadata={"status": membership.status, "target_user_id": str(membership.user_id)},
            ip_address=request.META.get("REMOTE_ADDR"),
            user_agent=request.headers.get("User-Agent", ""),
        )

        return response.Response(CompanyMemberSerializer(membership).data)


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
