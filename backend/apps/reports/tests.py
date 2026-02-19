from decimal import Decimal
from time import perf_counter

from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounting.models import Account
from apps.companies.services import create_company_for_user
from apps.journals.models import JournalEntry, JournalStatus
from apps.journals.services import post_journal_entry, replace_journal_lines
from apps.users.models import User


class ReportsApiTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="report-owner@test.local",
            password="SecurePass@123",
            full_name="Report Owner",
        )
        self.other_owner = User.objects.create_user(
            email="report-other-owner@test.local",
            password="SecurePass@123",
            full_name="Report Other Owner",
        )
        self.company = create_company_for_user(
            user=self.owner,
            company_data={
                "name": "Report Co",
                "slug": "report-co",
                "base_currency": "USD",
                "timezone": "UTC",
                "fiscal_year_start_month": 1,
                "is_active": True,
            },
        )
        self.other_company = create_company_for_user(
            user=self.other_owner,
            company_data={
                "name": "Other Report Co",
                "slug": "other-report-co",
                "base_currency": "USD",
                "timezone": "UTC",
                "fiscal_year_start_month": 1,
                "is_active": True,
            },
        )

        self.cash_account = Account.objects.create(
            company=self.company, code="1000", name="Cash", type="asset", normal_balance="debit"
        )
        self.equity_account = Account.objects.create(
            company=self.company, code="3000", name="Capital", type="equity", normal_balance="credit"
        )
        self.revenue_account = Account.objects.create(
            company=self.company, code="4000", name="Revenue", type="income", normal_balance="credit"
        )
        self.expense_account = Account.objects.create(
            company=self.company, code="5000", name="Expense", type="expense", normal_balance="debit"
        )

        self.client.force_authenticate(user=self.owner)

    def _post_entry(self, entry_date, lines):
        entry = JournalEntry.objects.create(
            company=self.company,
            status=JournalStatus.DRAFT,
            entry_date=entry_date,
            description="Report seed entry",
        )
        replace_journal_lines(entry=entry, lines=lines)
        post_journal_entry(entry=entry, actor_user=self.owner)
        return entry

    def test_profit_loss_and_cash_flow(self):
        self._post_entry(
            "2026-02-01",
            [
                {"account": self.cash_account, "debit": Decimal("300"), "credit": Decimal("0"), "description": ""},
                {"account": self.revenue_account, "debit": Decimal("0"), "credit": Decimal("300"), "description": ""},
            ],
        )
        self._post_entry(
            "2026-02-02",
            [
                {"account": self.expense_account, "debit": Decimal("100"), "credit": Decimal("0"), "description": ""},
                {"account": self.cash_account, "debit": Decimal("0"), "credit": Decimal("100"), "description": ""},
            ],
        )

        pnl = self.client.get(
            f"/api/v1/reports/companies/{self.company.id}/profit-loss/?start_date=2026-02-01&end_date=2026-02-28"
        )
        self.assertEqual(pnl.status_code, status.HTTP_200_OK)
        self.assertEqual(pnl.data["income_total"], "300.0000")
        self.assertEqual(pnl.data["expense_total"], "100.0000")
        self.assertEqual(pnl.data["net_profit"], "200.0000")

        cash_flow = self.client.get(
            f"/api/v1/reports/companies/{self.company.id}/cash-flow/?start_date=2026-02-01&end_date=2026-02-28"
        )
        self.assertEqual(cash_flow.status_code, status.HTTP_200_OK)
        self.assertEqual(cash_flow.data["net_cash_movement"], "200.0000")

    def test_balance_sheet_trial_balance_and_general_ledger(self):
        self._post_entry(
            "2026-02-03",
            [
                {"account": self.cash_account, "debit": Decimal("500"), "credit": Decimal("0"), "description": ""},
                {"account": self.equity_account, "debit": Decimal("0"), "credit": Decimal("500"), "description": ""},
            ],
        )

        balance_sheet = self.client.get(f"/api/v1/reports/companies/{self.company.id}/balance-sheet/?as_of=2026-02-28")
        self.assertEqual(balance_sheet.status_code, status.HTTP_200_OK)
        self.assertEqual(balance_sheet.data["asset_total"], "500.0000")
        self.assertEqual(balance_sheet.data["equity_total"], "500.0000")

        trial_balance = self.client.get(
            f"/api/v1/reports/companies/{self.company.id}/trial-balance/?start_date=2026-02-01&end_date=2026-02-28"
        )
        self.assertEqual(trial_balance.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(trial_balance.data["rows"]), 2)

        general_ledger = self.client.get(
            f"/api/v1/reports/companies/{self.company.id}/general-ledger/?start_date=2026-02-01&end_date=2026-02-28&limit=1"
        )
        self.assertEqual(general_ledger.status_code, status.HTTP_200_OK)
        self.assertEqual(len(general_ledger.data["rows"]), 1)

    def test_cross_tenant_reports_access_denied(self):
        self.client.force_authenticate(user=self.other_owner)
        response = self.client.get(f"/api/v1/reports/companies/{self.company.id}/profit-loss/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_profit_loss_csv_export(self):
        self._post_entry(
            "2026-02-01",
            [
                {"account": self.cash_account, "debit": Decimal("150"), "credit": Decimal("0"), "description": ""},
                {"account": self.revenue_account, "debit": Decimal("0"), "credit": Decimal("150"), "description": ""},
            ],
        )
        response = self.client.get(
            f"/api/v1/reports/companies/{self.company.id}/profit-loss/?start_date=2026-02-01&end_date=2026-02-28&export=csv"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response["Content-Type"].startswith("text/csv"))
        self.assertIn("attachment; filename=", response["Content-Disposition"])
        self.assertIn("account_code,account_name,account_type,balance", response.content.decode())

    def test_general_ledger_csv_export(self):
        self._post_entry(
            "2026-02-03",
            [
                {"account": self.cash_account, "debit": Decimal("500"), "credit": Decimal("0"), "description": ""},
                {"account": self.equity_account, "debit": Decimal("0"), "credit": Decimal("500"), "description": ""},
            ],
        )
        response = self.client.get(
            f"/api/v1/reports/companies/{self.company.id}/general-ledger/?start_date=2026-02-01&end_date=2026-02-28&limit=10&export=csv"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response["Content-Type"].startswith("text/csv"))
        self.assertIn("entry_date,entry_no,account_code,account_name,description,debit,credit", response.content.decode())

    def test_general_ledger_limit_validation(self):
        response = self.client.get(
            f"/api/v1/reports/companies/{self.company.id}/general-ledger/"
            "?start_date=2026-02-01&end_date=2026-02-28&limit=501"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_general_ledger_query_budget(self):
        for idx in range(12):
            amount = Decimal("10.00") + Decimal(idx)
            self._post_entry(
                "2026-02-03",
                [
                    {"account": self.cash_account, "debit": amount, "credit": Decimal("0"), "description": ""},
                    {"account": self.equity_account, "debit": Decimal("0"), "credit": amount, "description": ""},
                ],
            )

        with CaptureQueriesContext(connection) as queries:
            response = self.client.get(
                f"/api/v1/reports/companies/{self.company.id}/general-ledger/"
                "?start_date=2026-02-01&end_date=2026-02-28&limit=50"
            )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertLessEqual(len(queries), 15)

    def test_general_ledger_latency_smoke(self):
        for idx in range(20):
            amount = Decimal("5.00") + Decimal(idx)
            self._post_entry(
                "2026-02-04",
                [
                    {"account": self.cash_account, "debit": amount, "credit": Decimal("0"), "description": ""},
                    {"account": self.equity_account, "debit": Decimal("0"), "credit": amount, "description": ""},
                ],
            )

        started_at = perf_counter()
        for _ in range(10):
            response = self.client.get(
                f"/api/v1/reports/companies/{self.company.id}/general-ledger/"
                "?start_date=2026-02-01&end_date=2026-02-28&limit=50"
            )
            self.assertEqual(response.status_code, status.HTTP_200_OK)
        elapsed = perf_counter() - started_at

        # Local smoke threshold only; not a benchmark.
        self.assertLess(elapsed, 10.0)
