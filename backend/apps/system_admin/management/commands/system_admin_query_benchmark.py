from time import perf_counter

from django.core.management.base import BaseCommand, CommandError
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.system_admin.models import SystemRole
from apps.system_admin.views import (
    SystemAuditLogListView,
    SystemCompanyListView,
    SystemUserListView,
)
from apps.users.models import User


class Command(BaseCommand):
    help = "Benchmark query counts for system-admin hot list endpoints."

    BENCHMARKS = (
        ("companies_list", "/api/v1/system/companies/", SystemCompanyListView.as_view(), 12),
        ("users_list", "/api/v1/system/users/", SystemUserListView.as_view(), 12),
        ("audit_logs_list", "/api/v1/system/audit-logs/", SystemAuditLogListView.as_view(), 12),
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--email",
            type=str,
            default="",
            help="System admin email to run benchmark as. Defaults to first active SUPER_ADMIN.",
        )
        parser.add_argument(
            "--page-size",
            type=int,
            default=25,
            help="Page size used for list endpoint benchmark requests.",
        )
        parser.add_argument(
            "--strict",
            action="store_true",
            help="Exit with code 1 when any benchmark exceeds the query budget or returns non-2xx.",
        )

    def handle(self, *args, **options):
        user = self._resolve_user(email=(options.get("email") or "").strip().lower())
        page_size = options["page_size"]
        strict = options["strict"]
        factory = APIRequestFactory()

        self.stdout.write(self.style.NOTICE(f"System-admin query benchmark as {user.email}"))
        self.stdout.write("-" * 72)

        has_failure = False
        for name, path, view, query_budget in self.BENCHMARKS:
            request = factory.get(path, {"page": 1, "page_size": page_size})
            force_authenticate(request, user=user)

            start = perf_counter()
            with CaptureQueriesContext(connection) as captured:
                response = view(request)
            duration_ms = round((perf_counter() - start) * 1000.0, 2)

            status_code = int(response.status_code)
            query_count = len(captured)
            over_budget = query_count > query_budget
            failed_status = status_code >= 400
            failed = over_budget or failed_status
            has_failure = has_failure or failed

            status_label = "PASS" if not failed else "FAIL"
            line = (
                f"[{status_label}] {name}: status={status_code} "
                f"queries={query_count}/{query_budget} duration_ms={duration_ms}"
            )
            if failed:
                self.stdout.write(self.style.ERROR(line))
            else:
                self.stdout.write(self.style.SUCCESS(line))

        if strict and has_failure:
            raise SystemExit(1)

    def _resolve_user(self, *, email: str) -> User:
        if email:
            user = User.objects.filter(email__iexact=email, is_active=True).first()
            if user is None:
                raise CommandError(f"Active user not found for email: {email}")
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
