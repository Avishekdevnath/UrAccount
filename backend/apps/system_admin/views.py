from django.conf import settings
from django.db import transaction
from django.db.models import Count, Q
from rest_framework import generics
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.companies.models import Company, CompanyMember, CompanyMemberStatus
from apps.rbac.models import CompanyRole, CompanyRoleAssignment
from apps.system_admin.permissions import IsSystemAdmin, IsSystemSuperAdmin
from apps.system_admin.serializers import (
    SystemAuditLogSerializer,
    SystemCompanyBootstrapSerializer,
    SystemCompanyDetailSerializer,
    SystemCompanyFeatureFlagsSerializer,
    SystemCompanyFeatureFlagsUpdateSerializer,
    SystemCompanyMemberRolesUpdateSerializer,
    SystemCompanyMemberSerializer,
    SystemCompanyMemberUpsertSerializer,
    SystemCompanyQuotasSerializer,
    SystemCompanyQuotasUpdateSerializer,
    SystemCompanySerializer,
    SystemCompanyStatusUpdateSerializer,
    SystemFeatureFlagsSerializer,
    SystemUserCreateSerializer,
    SystemUserDetailSerializer,
    SystemUserResetPasswordSerializer,
    SystemUserRoleUpdateSerializer,
    SystemUserSerializer,
    SystemUserUpdateSerializer,
)
from apps.system_admin.models import SystemAuditLog, SystemCompanyConfig, SystemRole
from apps.system_admin.services import bootstrap_company_with_owner, log_system_audit_event
from apps.users.models import User


class SystemHealthView(APIView):
    permission_classes = [IsSystemAdmin]

    def get(self, request):
        return Response({"status": "ok"})


class SystemCompanyListView(generics.ListAPIView):
    permission_classes = [IsSystemAdmin]
    serializer_class = SystemCompanySerializer

    def get_queryset(self):
        return _system_company_queryset()


class SystemCompanyBootstrapView(APIView):
    """POST /api/v1/system/companies/bootstrap/ - create company and bootstrap owner account."""

    permission_classes = [IsSystemSuperAdmin]

    def post(self, request):
        serializer = SystemCompanyBootstrapSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated = serializer.validated_data

        result = bootstrap_company_with_owner(
            company_data=validated["company"],
            owner_data=validated["owner"],
        )
        company = result["company"]
        owner = result["owner"]
        owner_created = result["owner_created"]

        after = {
            "company_id": str(company.id),
            "company_slug": company.slug,
            "owner_user_id": str(owner.id),
            "owner_email": owner.email,
            "owner_created": owner_created,
        }
        log_system_audit_event(
            request=request,
            actor_user=request.user,
            action="system.company.bootstrap",
            resource_type="company",
            resource_id=str(company.id),
            before=None,
            after=after,
            metadata={"company_slug": company.slug, "owner_email": owner.email},
        )

        return Response(after, status=201)


class SystemCompanyDetailView(generics.RetrieveAPIView):
    permission_classes = [IsSystemAdmin]
    serializer_class = SystemCompanyDetailSerializer
    lookup_field = "id"
    lookup_url_kwarg = "company_id"

    def get_queryset(self):
        return _system_company_queryset().select_related("system_config")


class SystemCompanyFeatureFlagsView(APIView):
    permission_classes = [IsSystemAdmin]

    def get_permissions(self):
        if self.request.method == "PATCH":
            return [IsSystemSuperAdmin()]
        return [IsSystemAdmin()]

    def get(self, request, company_id):
        company = _get_company(company_id=company_id)
        config = _get_company_config(company=company)
        serializer = SystemCompanyFeatureFlagsSerializer(
            SystemCompanyFeatureFlagsSerializer.from_config(config)
        )
        return Response(
            {
                "company_id": str(company.id),
                "company_slug": company.slug,
                "feature_flags": serializer.data,
            }
        )

    def patch(self, request, company_id):
        company = _get_company(company_id=company_id)
        config = _get_company_config(company=company)

        serializer = SystemCompanyFeatureFlagsUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updates = serializer.validated_data
        if not updates:
            return Response(
                {
                    "company_id": str(company.id),
                    "company_slug": company.slug,
                    "feature_flags": SystemCompanyFeatureFlagsSerializer.from_config(config),
                }
            )

        before = SystemCompanyFeatureFlagsSerializer.from_config(config)
        for field, value in updates.items():
            setattr(config, field, value)
        config.save()
        after = SystemCompanyFeatureFlagsSerializer.from_config(config)

        log_system_audit_event(
            request=request,
            actor_user=request.user,
            action="system.company.feature_flags.update",
            resource_type="system_company_config",
            resource_id=str(config.id),
            before=before,
            after=after,
            metadata={"company_id": str(company.id), "company_slug": company.slug},
        )

        return Response(
            {
                "company_id": str(company.id),
                "company_slug": company.slug,
                "feature_flags": after,
            }
        )


class SystemCompanyQuotasView(APIView):
    permission_classes = [IsSystemAdmin]

    def get_permissions(self):
        if self.request.method == "PATCH":
            return [IsSystemSuperAdmin()]
        return [IsSystemAdmin()]

    def get(self, request, company_id):
        company = _get_company(company_id=company_id)
        config = _get_company_config(company=company)
        quotas = SystemCompanyQuotasSerializer.from_config(config)
        return Response(
            {
                "company_id": str(company.id),
                "company_slug": company.slug,
                "quotas": quotas,
            }
        )

    def patch(self, request, company_id):
        company = _get_company(company_id=company_id)
        config = _get_company_config(company=company)

        serializer = SystemCompanyQuotasUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updates = serializer.validated_data
        if not updates:
            return Response(
                {
                    "company_id": str(company.id),
                    "company_slug": company.slug,
                    "quotas": SystemCompanyQuotasSerializer.from_config(config),
                }
            )

        before = SystemCompanyQuotasSerializer.from_config(config)
        for field, value in updates.items():
            setattr(config, field, value)
        config.save()
        after = SystemCompanyQuotasSerializer.from_config(config)

        log_system_audit_event(
            request=request,
            actor_user=request.user,
            action="system.company.quotas.update",
            resource_type="system_company_config",
            resource_id=str(config.id),
            before=before,
            after=after,
            metadata={"company_id": str(company.id), "company_slug": company.slug},
        )

        return Response(
            {
                "company_id": str(company.id),
                "company_slug": company.slug,
                "quotas": after,
            }
        )


class SystemCompanyMemberUpsertView(APIView):
    """POST /api/v1/system/companies/<company_id>/members/ - add or update a company member and roles."""

    permission_classes = [IsSystemSuperAdmin]
    throttle_scope = "system_role_mutation"

    @transaction.atomic
    def post(self, request, company_id):
        company = _get_company(company_id=company_id)
        serializer = SystemCompanyMemberUpsertSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        user = generics.get_object_or_404(User, id=data["user_id"])
        member, _ = CompanyMember.objects.update_or_create(
            company=company,
            user=user,
            defaults={"status": data.get("status", CompanyMemberStatus.ACTIVE)},
        )

        before_roles = sorted(
            CompanyRoleAssignment.objects.filter(company=company, user=user).values_list("role__name", flat=True)
        )
        if "roles" in data:
            _replace_company_member_roles(company=company, user=user, role_names=data["roles"])
        after_roles = sorted(
            CompanyRoleAssignment.objects.filter(company=company, user=user).values_list("role__name", flat=True)
        )

        log_system_audit_event(
            request=request,
            actor_user=request.user,
            action="system.company.member.upsert",
            resource_type="company_member",
            resource_id=str(member.id),
            before={"status": None, "roles": before_roles},
            after={"status": member.status, "roles": after_roles},
            metadata={"company_id": str(company.id), "user_id": str(user.id), "user_email": user.email},
        )

        return Response(SystemCompanyMemberSerializer(member).data, status=201)


class SystemCompanyMemberRolesView(APIView):
    """PATCH /api/v1/system/companies/<company_id>/members/<user_id>/roles/ - replace member roles."""

    permission_classes = [IsSystemSuperAdmin]
    throttle_scope = "system_role_mutation"

    @transaction.atomic
    def patch(self, request, company_id, user_id):
        company = _get_company(company_id=company_id)
        user = generics.get_object_or_404(User, id=user_id)
        member = generics.get_object_or_404(CompanyMember, company=company, user=user)

        serializer = SystemCompanyMemberRolesUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        role_names = serializer.validated_data["roles"]

        before_roles = sorted(
            CompanyRoleAssignment.objects.filter(company=company, user=user).values_list("role__name", flat=True)
        )
        _replace_company_member_roles(company=company, user=user, role_names=role_names)
        after_roles = sorted(
            CompanyRoleAssignment.objects.filter(company=company, user=user).values_list("role__name", flat=True)
        )

        log_system_audit_event(
            request=request,
            actor_user=request.user,
            action="system.company.member.roles.replace",
            resource_type="company_member",
            resource_id=str(member.id),
            before={"roles": before_roles},
            after={"roles": after_roles},
            metadata={"company_id": str(company.id), "user_id": str(user.id), "user_email": user.email},
        )

        return Response(
            {
                "company_id": str(company.id),
                "user_id": str(user.id),
                "roles": after_roles,
            }
        )


class SystemCompanyMemberRemoveView(APIView):
    """DELETE /api/v1/system/companies/<company_id>/members/<user_id>/ - disable membership and clear roles."""

    permission_classes = [IsSystemSuperAdmin]
    throttle_scope = "system_role_mutation"

    @transaction.atomic
    def delete(self, request, company_id, user_id):
        company = _get_company(company_id=company_id)
        user = generics.get_object_or_404(User, id=user_id)
        member = generics.get_object_or_404(CompanyMember, company=company, user=user)

        before = {
            "status": member.status,
            "roles": sorted(
                CompanyRoleAssignment.objects.filter(company=company, user=user).values_list("role__name", flat=True)
            ),
        }

        member.status = CompanyMemberStatus.DISABLED
        member.save(update_fields=["status", "updated_at"])
        CompanyRoleAssignment.objects.filter(company=company, user=user).delete()

        after = {"status": member.status, "roles": []}
        log_system_audit_event(
            request=request,
            actor_user=request.user,
            action="system.company.member.remove",
            resource_type="company_member",
            resource_id=str(member.id),
            before=before,
            after=after,
            metadata={"company_id": str(company.id), "user_id": str(user.id), "user_email": user.email},
        )

        return Response(status=204)


def _system_company_queryset():
    return Company.objects.annotate(
        members_count=Count(
            "memberships",
            filter=Q(memberships__status=CompanyMemberStatus.ACTIVE),
            distinct=True,
        )
    ).order_by("name")


def _get_company(*, company_id):
    return generics.get_object_or_404(Company, id=company_id)


def _get_company_config(*, company: Company) -> SystemCompanyConfig:
    config, _ = SystemCompanyConfig.objects.get_or_create(company=company)
    return config


def _assert_not_last_super_admin(user: User) -> None:
    """Raise ValidationError if this action would leave no active SUPER_ADMIN."""
    role = getattr(user, "system_role", None)
    if role and role.role == SystemRole.ROLE_SUPER_ADMIN and role.is_active:
        remaining = SystemRole.objects.filter(
            role=SystemRole.ROLE_SUPER_ADMIN,
            is_active=True,
        ).exclude(user=user).count()
        if remaining == 0:
            raise ValidationError({"detail": "Cannot remove the last active SUPER_ADMIN."})


def _assert_user_not_protected(user: User) -> None:
    protected = set(getattr(settings, "PROTECTED_SYSTEM_USER_EMAILS", []))
    user_email = (user.email or "").strip().lower()
    if user.is_superuser or (user_email and user_email in protected):
        raise ValidationError({"detail": "Protected service account cannot be mutated."})


def _replace_company_member_roles(*, company: Company, user: User, role_names: list[str]) -> None:
    role_names_set = {name.strip() for name in role_names if name.strip()}
    if role_names_set:
        valid_roles = {role.name: role for role in CompanyRole.objects.filter(company=company, name__in=role_names_set)}
        missing = sorted(role_names_set.difference(valid_roles.keys()))
        if missing:
            raise ValidationError({"detail": f"Unknown company role(s): {', '.join(missing)}"})
    else:
        valid_roles = {}

    CompanyRoleAssignment.objects.filter(company=company, user=user).exclude(role__name__in=role_names_set).delete()
    for role_name in sorted(role_names_set):
        CompanyRoleAssignment.objects.get_or_create(company=company, user=user, role=valid_roles[role_name])


class SystemUserListView(generics.ListCreateAPIView):
    permission_classes = [IsSystemAdmin]
    serializer_class = SystemUserSerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsSystemSuperAdmin()]
        return [IsSystemAdmin()]

    def get_queryset(self):
        return _system_user_queryset()

    def get_serializer_class(self):
        if self.request.method == "POST":
            return SystemUserCreateSerializer
        return SystemUserSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = User.objects.create_user(
            email=serializer.validated_data["email"],
            password=serializer.validated_data["password"],
            full_name=serializer.validated_data["full_name"],
            is_active=serializer.validated_data.get("is_active", True),
            is_staff=serializer.validated_data.get("is_staff", False),
        )

        log_system_audit_event(
            request=request,
            actor_user=request.user,
            action="system.user.create",
            resource_type="user",
            resource_id=str(user.id),
            before=None,
            after={
                "email": user.email,
                "full_name": user.full_name,
                "is_active": user.is_active,
                "is_staff": user.is_staff,
            },
            metadata={"user_email": user.email},
        )

        output = SystemUserDetailSerializer(user).data
        return Response(output, status=201)


class SystemUserDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsSystemAdmin]
    serializer_class = SystemUserDetailSerializer
    lookup_field = "id"
    lookup_url_kwarg = "user_id"

    def get_permissions(self):
        if self.request.method in {"PATCH", "DELETE"}:
            return [IsSystemSuperAdmin()]
        return [IsSystemAdmin()]

    def get_queryset(self):
        return _system_user_queryset().prefetch_related("company_memberships__company")

    def get_serializer_class(self):
        if self.request.method == "PATCH":
            return SystemUserUpdateSerializer
        return SystemUserDetailSerializer

    def patch(self, request, *args, **kwargs):
        user = self.get_object()
        _assert_user_not_protected(user)
        serializer = self.get_serializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updates = serializer.validated_data
        if not updates:
            return Response(SystemUserDetailSerializer(user).data)

        before = {
            "full_name": user.full_name,
            "is_active": user.is_active,
            "is_staff": user.is_staff,
        }
        for field, value in updates.items():
            setattr(user, field, value)
        user.save()
        after = {
            "full_name": user.full_name,
            "is_active": user.is_active,
            "is_staff": user.is_staff,
        }

        log_system_audit_event(
            request=request,
            actor_user=request.user,
            action="system.user.update",
            resource_type="user",
            resource_id=str(user.id),
            before=before,
            after=after,
            metadata={"user_email": user.email},
        )

        return Response(SystemUserDetailSerializer(user).data)

    def delete(self, request, *args, **kwargs):
        user = self.get_object()
        _assert_user_not_protected(user)
        _assert_not_last_super_admin(user)
        before = {
            "is_active": user.is_active,
            "system_role": (
                {"role": user.system_role.role, "is_active": user.system_role.is_active}
                if hasattr(user, "system_role")
                else None
            ),
        }

        user.is_active = False
        user.save(update_fields=["is_active"])
        if hasattr(user, "system_role"):
            system_role = user.system_role
            system_role.is_active = False
            system_role.save(update_fields=["is_active"])

        after = {
            "is_active": user.is_active,
            "system_role": (
                {"role": user.system_role.role, "is_active": user.system_role.is_active}
                if hasattr(user, "system_role")
                else None
            ),
        }

        log_system_audit_event(
            request=request,
            actor_user=request.user,
            action="system.user.deactivate",
            resource_type="user",
            resource_id=str(user.id),
            before=before,
            after=after,
            metadata={"user_email": user.email},
        )

        return Response(status=204)


class SystemUserResetPasswordView(APIView):
    permission_classes = [IsSystemSuperAdmin]
    throttle_scope = "system_password_reset"

    def post(self, request, user_id):
        user = generics.get_object_or_404(User, id=user_id)
        _assert_user_not_protected(user)
        serializer = SystemUserResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user.set_password(serializer.validated_data["new_password"])
        user.save(update_fields=["password", "password_changed_at"])

        log_system_audit_event(
            request=request,
            actor_user=request.user,
            action="system.user.reset_password",
            resource_type="user",
            resource_id=str(user.id),
            before=None,
            after={"password_reset": True},
            metadata={"user_email": user.email},
        )
        return Response({"user_id": str(user.id), "user_email": user.email, "password_reset": True})


def _system_user_queryset():
    return (
        User.objects.select_related("system_role")
        .annotate(
            company_count=Count(
                "company_memberships__company",
                filter=Q(company_memberships__status=CompanyMemberStatus.ACTIVE),
                distinct=True,
            )
        )
        .order_by("email")
    )


class SystemFeatureFlagsView(APIView):
    permission_classes = [IsSystemAdmin]

    def get(self, request):
        serializer = SystemFeatureFlagsSerializer(SystemFeatureFlagsSerializer.from_settings())
        return Response(serializer.data)


class SystemCompanyStatusView(APIView):
    """PATCH /api/v1/system/companies/<company_id>/status/ — activate or deactivate a company."""

    permission_classes = [IsSystemSuperAdmin]

    def patch(self, request, company_id):
        company = _get_company(company_id=company_id)

        serializer = SystemCompanyStatusUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        before = {"is_active": company.is_active}
        company.is_active = serializer.validated_data["is_active"]
        company.save(update_fields=["is_active"])
        after = {"is_active": company.is_active}

        log_system_audit_event(
            request=request,
            actor_user=request.user,
            action="system.company.status.update",
            resource_type="company",
            resource_id=str(company.id),
            before=before,
            after=after,
            metadata={"company_id": str(company.id), "company_slug": company.slug},
        )

        return Response(
            {
                "company_id": str(company.id),
                "company_slug": company.slug,
                "is_active": company.is_active,
            }
        )


class SystemUserRoleView(APIView):
    """PATCH /api/v1/system/users/<user_id>/system-role/ — grant, update, or revoke a system role."""

    permission_classes = [IsSystemSuperAdmin]
    throttle_scope = "system_role_mutation"

    def patch(self, request, user_id):
        user = generics.get_object_or_404(User, id=user_id)
        _assert_user_not_protected(user)

        serializer = SystemUserRoleUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        role_value = data.get("role", ...)  # sentinel: not provided
        is_active = data.get("is_active", ...)

        try:
            system_role = SystemRole.objects.get(user=user)
        except SystemRole.DoesNotExist:
            system_role = None

        before = (
            {"role": system_role.role, "is_active": system_role.is_active}
            if system_role
            else None
        )

        # role=null means revoke
        if "role" in data and data["role"] is None:
            if system_role:
                _assert_not_last_super_admin(user)
                system_role.delete()
                system_role = None
            after = None
        else:
            # Create or update
            defaults = {}
            if "role" in data and data["role"] is not None:
                defaults["role"] = data["role"]
            if "is_active" in data:
                defaults["is_active"] = data["is_active"]
            # Guard: disabling the last active SUPER_ADMIN
            if "is_active" in defaults and not defaults["is_active"]:
                _assert_not_last_super_admin(user)

            if system_role is None:
                if "role" not in data or data["role"] is None:
                    raise ValidationError({"detail": "role is required when creating a system role."})
                system_role = SystemRole.objects.create(
                    user=user,
                    role=data["role"],
                    is_active=data.get("is_active", True),
                )
            else:
                for field, value in defaults.items():
                    setattr(system_role, field, value)
                system_role.save()

            after = {"role": system_role.role, "is_active": system_role.is_active}

        log_system_audit_event(
            request=request,
            actor_user=request.user,
            action="system.user.system_role.update",
            resource_type="system_role",
            resource_id=str(user.id),
            before=before,
            after=after,
            metadata={"user_id": str(user.id), "user_email": user.email},
        )

        return Response(
            {
                "user_id": str(user.id),
                "user_email": user.email,
                "system_role": after,
            }
        )


class SystemAuditLogListView(generics.ListAPIView):
    """GET /api/v1/system/audit-logs/ — paginated, filterable audit log."""

    permission_classes = [IsSystemAdmin]
    serializer_class = SystemAuditLogSerializer

    def get_queryset(self):
        qs = SystemAuditLog.objects.select_related("actor").order_by("-created_at")

        action = self.request.query_params.get("action")
        resource_type = self.request.query_params.get("resource_type")
        actor_id = self.request.query_params.get("actor_id")
        date_from = self.request.query_params.get("date_from")
        date_to = self.request.query_params.get("date_to")

        if action:
            qs = qs.filter(action__icontains=action)
        if resource_type:
            qs = qs.filter(resource_type=resource_type)
        if actor_id:
            qs = qs.filter(actor_id=actor_id)
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)

        return qs
