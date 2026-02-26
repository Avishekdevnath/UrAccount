from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.system_admin.models import SystemRole
from apps.users.models import User


class Command(BaseCommand):
    help = "Create or update a system operator account and assign a system role."

    def add_arguments(self, parser):
        parser.add_argument("--email", required=True, help="Operator email.")
        parser.add_argument("--full-name", required=True, help="Operator full name.")
        parser.add_argument(
            "--password",
            required=False,
            help="Password (required when creating a new user).",
        )
        parser.add_argument(
            "--role",
            type=str,
            choices=[SystemRole.ROLE_SUPER_ADMIN, SystemRole.ROLE_SUPPORT],
            default=SystemRole.ROLE_SUPER_ADMIN,
            help="System role to assign.",
        )
        parser.add_argument(
            "--inactive-role",
            action="store_true",
            help="Mark system role as inactive.",
        )
        parser.add_argument(
            "--no-staff",
            action="store_true",
            help="Do not set user.is_staff=True.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        email = options["email"].strip().lower()
        full_name = options["full_name"].strip()
        password = options.get("password")
        role_value = options["role"]
        role_active = not options["inactive_role"]
        is_staff = not options["no_staff"]

        user = User.objects.filter(email__iexact=email).first()
        created_user = user is None

        if created_user and not password:
            raise CommandError("--password is required when creating a new operator user.")

        if created_user:
            user = User.objects.create_user(
                email=email,
                password=password,
                full_name=full_name,
                is_active=True,
                is_staff=is_staff,
            )
        else:
            user.full_name = full_name
            user.is_active = True
            user.is_staff = is_staff
            if password:
                user.set_password(password)
                user.save(
                    update_fields=["full_name", "is_active", "is_staff", "password", "password_changed_at"]
                )
            else:
                user.save(update_fields=["full_name", "is_active", "is_staff"])

        role, created_role = SystemRole.objects.update_or_create(
            user=user,
            defaults={"role": role_value, "is_active": role_active},
        )

        self.stdout.write(
            self.style.SUCCESS(
                (
                    f"Operator {'created' if created_user else 'updated'}: {user.email}\n"
                    f"Role {'created' if created_role else 'updated'}: {role.role} "
                    f"(is_active={role.is_active})\n"
                    f"is_staff={user.is_staff} is_active={user.is_active}"
                )
            )
        )
