from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.system_admin.models import SystemRole
from apps.system_admin.views import (
    SystemAuditLogListView,
    SystemCompanyListView,
    SystemFeatureFlagsView,
    SystemHealthView,
    SystemUserListView,
)
from apps.users.models import User


class Command(BaseCommand):
    help = "Check whether an active SUPER_ADMIN can access core /system endpoints."

    CHECKS = (
        ("health", "/api/v1/system/health/", SystemHealthView.as_view()),
        ("feature_flags", "/api/v1/system/feature-flags/", SystemFeatureFlagsView.as_view()),
        ("companies_list", "/api/v1/system/companies/", SystemCompanyListView.as_view()),
        ("users_list", "/api/v1/system/users/", SystemUserListView.as_view()),
        ("audit_logs_list", "/api/v1/system/audit-logs/", SystemAuditLogListView.as_view()),
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--email",
            type=str,
            default="",
            help="System admin email to check. Defaults to first active SUPER_ADMIN.",
        )
        parser.add_argument(
            "--strict",
            action="store_true",
            help="Exit with code 1 when any endpoint check fails.",
        )

    def handle(self, *args, **options):
        if not settings.SYSTEM_ADMIN_ENABLED:
            raise CommandError("SYSTEM_ADMIN_ENABLED=0. Enable it before checking /system access.")

        user = self._resolve_user(email=(options.get("email") or "").strip().lower())
        strict = options["strict"]
        factory = APIRequestFactory()
        has_failure = False

        self.stdout.write(self.style.NOTICE(f"System-access check as {user.email}"))
        self.stdout.write("-" * 72)
        for name, path, view in self.CHECKS:
            request = factory.get(path, {"page": 1, "page_size": 10})
            force_authenticate(request, user=user)
            response = view(request)
            status_code = int(response.status_code)
            ok = status_code < 400
            has_failure = has_failure or (not ok)
            line = f"[{'PASS' if ok else 'FAIL'}] {name}: status={status_code} path={path}"
            if ok:
                self.stdout.write(self.style.SUCCESS(line))
            else:
                self.stdout.write(self.style.ERROR(line))

        if strict and has_failure:
            raise SystemExit(1)

    def _resolve_user(self, *, email: str) -> User:
        if email:
            user = User.objects.filter(email__iexact=email, is_active=True).first()
            if user is None:
                raise CommandError(f"Active user not found: {email}")
            role = getattr(user, "system_role", None)
            if not role or not role.is_active or role.role != SystemRole.ROLE_SUPER_ADMIN:
                raise CommandError(f"User is not an active SUPER_ADMIN: {email}")
            return user

        role = (
            SystemRole.objects.select_related("user")
            .filter(role=SystemRole.ROLE_SUPER_ADMIN, is_active=True, user__is_active=True)
            .order_by("created_at")
            .first()
        )
        if role is None:
            raise CommandError("No active SUPER_ADMIN found. Run bootstrap_system_operator first.")
        return role.user
