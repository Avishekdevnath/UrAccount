from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import connections
from django.db.migrations.executor import MigrationExecutor

from apps.system_admin.models import SystemRole
from apps.users.models import User


class Command(BaseCommand):
    help = "Preflight checks for system-admin rollout readiness."

    def add_arguments(self, parser):
        parser.add_argument(
            "--strict",
            action="store_true",
            help="Return non-zero exit code when any required check fails.",
        )

    def handle(self, *args, **options):
        checks = []

        checks.append(("SYSTEM_ADMIN_ENABLED configured", True, f"value={settings.SYSTEM_ADMIN_ENABLED}"))
        checks.append(("Active SUPER_ADMIN exists", self._has_active_super_admin(), "required for /system control plane"))
        checks.append(("Protected operator emails configured", bool(settings.PROTECTED_SYSTEM_USER_EMAILS), "recommended for prod"))
        checks.append(("No pending migrations", self._no_pending_migrations(), "run `py manage.py migrate` if failed"))

        failed_required = False
        self.stdout.write(self.style.NOTICE("System Admin Preflight"))
        self.stdout.write("-" * 64)
        for label, ok, detail in checks:
            status = "PASS" if ok else "FAIL"
            line = f"[{status}] {label} - {detail}"
            if ok:
                self.stdout.write(self.style.SUCCESS(line))
            else:
                self.stdout.write(self.style.ERROR(line))
                if label in {"Active SUPER_ADMIN exists", "No pending migrations"}:
                    failed_required = True

        if options["strict"] and failed_required:
            raise SystemExit(1)

    def _has_active_super_admin(self) -> bool:
        return SystemRole.objects.filter(role=SystemRole.ROLE_SUPER_ADMIN, is_active=True).exists()

    def _no_pending_migrations(self) -> bool:
        connection = connections["default"]
        executor = MigrationExecutor(connection)
        plan = executor.migration_plan(executor.loader.graph.leaf_nodes())
        return len(plan) == 0
