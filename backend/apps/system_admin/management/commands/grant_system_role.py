from django.core.management.base import BaseCommand, CommandError

from apps.system_admin.models import SystemRole
from apps.users.models import User


class Command(BaseCommand):
    help = "Grant or update a system role for an existing user."

    def add_arguments(self, parser):
        parser.add_argument("email", type=str, help="User email to grant role for.")
        parser.add_argument(
            "--role",
            type=str,
            choices=[SystemRole.ROLE_SUPER_ADMIN, SystemRole.ROLE_SUPPORT],
            default=SystemRole.ROLE_SUPER_ADMIN,
            help="System role to assign.",
        )
        parser.add_argument(
            "--inactive",
            action="store_true",
            help="Create/update the role as inactive.",
        )

    def handle(self, *args, **options):
        email = options["email"].strip().lower()
        role_value = options["role"]
        is_active = not options["inactive"]

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist as exc:
            raise CommandError(f"User not found: {email}") from exc

        role, created = SystemRole.objects.update_or_create(
            user=user,
            defaults={"role": role_value, "is_active": is_active},
        )

        action = "created" if created else "updated"
        self.stdout.write(
            self.style.SUCCESS(
                f"System role {action} for {user.email}: role={role.role}, is_active={role.is_active}"
            )
        )
