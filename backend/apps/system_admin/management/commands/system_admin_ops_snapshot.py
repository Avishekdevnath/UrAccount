from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db.models import Count
from django.utils import timezone

from apps.companies.models import Company
from apps.system_admin.models import SystemAuditLog, SystemRole


class Command(BaseCommand):
    help = "Print a system-admin operations snapshot for rollout monitoring."

    def add_arguments(self, parser):
        parser.add_argument(
            "--hours",
            type=int,
            default=24,
            help="Time window for audit metrics (default: 24h).",
        )
        parser.add_argument(
            "--top",
            type=int,
            default=10,
            help="Top N rows for grouped sections.",
        )

    def handle(self, *args, **options):
        window_hours = max(1, int(options["hours"]))
        top_n = max(1, int(options["top"]))
        since = timezone.now() - timedelta(hours=window_hours)

        active_super_admins = SystemRole.objects.filter(
            role=SystemRole.ROLE_SUPER_ADMIN,
            is_active=True,
            user__is_active=True,
        ).count()
        active_support = SystemRole.objects.filter(
            role=SystemRole.ROLE_SUPPORT,
            is_active=True,
            user__is_active=True,
        ).count()

        total_companies = Company.objects.count()
        active_companies = Company.objects.filter(is_active=True).count()
        inactive_companies = total_companies - active_companies

        window_logs = SystemAuditLog.objects.filter(created_at__gte=since)
        audit_total = window_logs.count()
        denied_total = window_logs.filter(action="system.access.denied").count()
        error_total = window_logs.filter(action="system.response.error").count()
        error_rate_pct = round((error_total * 100.0 / audit_total), 2) if audit_total else 0.0

        top_actions = (
            window_logs.values("action")
            .annotate(count=Count("id"))
            .order_by("-count", "action")[:top_n]
        )
        top_denied_actors = (
            window_logs.filter(action="system.access.denied")
            .values("actor__email")
            .annotate(count=Count("id"))
            .order_by("-count", "actor__email")[:top_n]
        )

        self.stdout.write(self.style.NOTICE("System Admin Ops Snapshot"))
        self.stdout.write("-" * 72)
        self.stdout.write(f"Window: last {window_hours}h (since {since.isoformat()})")
        self.stdout.write("")
        self.stdout.write(f"Active SUPER_ADMIN operators: {active_super_admins}")
        self.stdout.write(f"Active SUPPORT operators: {active_support}")
        self.stdout.write("")
        self.stdout.write(f"Companies total/active/inactive: {total_companies}/{active_companies}/{inactive_companies}")
        self.stdout.write(f"System audit events in window: {audit_total}")
        self.stdout.write(f"Denied system-access events in window: {denied_total}")
        self.stdout.write(f"System endpoint 5xx audit events in window: {error_total} ({error_rate_pct}%)")
        self.stdout.write("")

        self.stdout.write(self.style.NOTICE("Top Actions"))
        if not top_actions:
            self.stdout.write("- no events in window")
        for row in top_actions:
            self.stdout.write(f"- {row['action']}: {row['count']}")

        self.stdout.write("")
        self.stdout.write(self.style.NOTICE("Top Denied Actors"))
        if not top_denied_actors:
            self.stdout.write("- no denied events in window")
        for row in top_denied_actors:
            actor_email = row["actor__email"] or "anonymous"
            self.stdout.write(f"- {actor_email}: {row['count']}")
