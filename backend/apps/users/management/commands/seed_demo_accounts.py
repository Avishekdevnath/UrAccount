from django.core.management.base import BaseCommand

from apps.users.demo_seed import DEMO_PASSWORD, seed_demo_company


class Command(BaseCommand):
    help = "Seed demo users and (optionally) a full demo-company accounting dataset"

    def add_arguments(self, parser):
        parser.add_argument(
            "--accounts-only",
            action="store_true",
            help="Seed only users/company/roles without accounting sector data.",
        )
        parser.add_argument(
            "--password",
            default=DEMO_PASSWORD,
            help="Password applied to all demo users (default: Demo@12345).",
        )

    def handle(self, *args, **options):
        summary = seed_demo_company(
            password=options["password"],
            include_company_data=not options["accounts_only"],
        )

        self.stdout.write(self.style.SUCCESS("Demo seed completed successfully."))
        self.stdout.write(f"Company: {summary['company_slug']}")
        self.stdout.write(f"Users: {', '.join(summary['users'])}")
        if summary.get("with_data"):
            self.stdout.write(
                "Data: "
                f"accounts={summary['account_count']}, "
                f"invoice={summary['invoice_status']}, "
                f"receipt={summary['receipt_status']}, "
                f"bill={summary['bill_status']}, "
                f"vendor_payment={summary['vendor_payment_status']}, "
                f"reconciliation={summary['reconciliation_status']}"
            )
