from decimal import Decimal

from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounting.models import Account
from apps.companies.services import create_company_for_user
from apps.journals.models import JournalEntry, JournalStatus
from apps.journals.services import post_journal_entry, replace_journal_lines
from apps.users.models import User


class BankingApiTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="bank-owner@test.local",
            password="SecurePass@123",
            full_name="Bank Owner",
        )
        self.other_owner = User.objects.create_user(
            email="bank-other-owner@test.local",
            password="SecurePass@123",
            full_name="Bank Other Owner",
        )
        self.company = create_company_for_user(
            user=self.owner,
            company_data={
                "name": "Bank Co",
                "slug": "bank-co",
                "base_currency": "USD",
                "timezone": "UTC",
                "fiscal_year_start_month": 1,
                "is_active": True,
            },
        )
        self.other_company = create_company_for_user(
            user=self.other_owner,
            company_data={
                "name": "Other Bank Co",
                "slug": "other-bank-co",
                "base_currency": "USD",
                "timezone": "UTC",
                "fiscal_year_start_month": 1,
                "is_active": True,
            },
        )

        self.cash_account = Account.objects.create(
            company=self.company, code="1000", name="Cash", type="asset", normal_balance="debit"
        )
        self.revenue_account = Account.objects.create(
            company=self.company, code="4000", name="Revenue", type="income", normal_balance="credit"
        )

        self.client.force_authenticate(user=self.owner)

    def _create_bank_account(self):
        response = self.client.post(
            f"/api/v1/banking/companies/{self.company.id}/bank-accounts/",
            {
                "name": "Main Bank",
                "account_number_last4": "1234",
                "currency_code": "USD",
                "ledger_account": str(self.cash_account.id),
                "is_active": True,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        return response.data["id"]

    def _create_posted_journal(self):
        entry = JournalEntry.objects.create(
            company=self.company,
            status=JournalStatus.DRAFT,
            entry_date="2026-02-21",
            description="Bank match target",
        )
        replace_journal_lines(
            entry=entry,
            lines=[
                {
                    "account": self.cash_account,
                    "debit": Decimal("50.00"),
                    "credit": Decimal("0"),
                    "description": "Cash in",
                },
                {
                    "account": self.revenue_account,
                    "debit": Decimal("0"),
                    "credit": Decimal("50.00"),
                    "description": "Revenue",
                },
            ],
        )
        post_journal_entry(entry=entry, actor_user=self.owner)
        return entry

    def test_csv_import_parses_transactions(self):
        bank_account_id = self._create_bank_account()
        response = self.client.post(
            f"/api/v1/banking/companies/{self.company.id}/imports/",
            {
                "bank_account": bank_account_id,
                "file_name": "statement.csv",
                "raw_content": "date,description,amount,reference\n2026-02-20,Deposit,50.00,REF1\n2026-02-21,Fee,-5.00,REF2",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["transactions_created"], 2)

        tx_list = self.client.get(f"/api/v1/banking/companies/{self.company.id}/transactions/")
        self.assertEqual(tx_list.status_code, status.HTTP_200_OK)
        self.assertEqual(len(tx_list.data), 2)

    def test_csv_import_rejects_missing_columns(self):
        bank_account_id = self._create_bank_account()
        response = self.client.post(
            f"/api/v1/banking/companies/{self.company.id}/imports/",
            {
                "bank_account": bank_account_id,
                "file_name": "bad.csv",
                "raw_content": "date,description\n2026-02-20,Deposit",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_match_and_finalize_reconciliation_flow(self):
        bank_account_id = self._create_bank_account()
        self.client.post(
            f"/api/v1/banking/companies/{self.company.id}/imports/",
            {
                "bank_account": bank_account_id,
                "file_name": "statement.csv",
                "raw_content": "date,description,amount,reference\n2026-02-21,Deposit,50.00,REF1",
            },
            format="json",
        )
        tx_list = self.client.get(f"/api/v1/banking/companies/{self.company.id}/transactions/")
        transaction_id = tx_list.data[0]["id"]

        entry = self._create_posted_journal()
        match_res = self.client.post(
            f"/api/v1/banking/companies/{self.company.id}/transactions/{transaction_id}/match/",
            {"journal_entry_id": str(entry.id)},
            format="json",
        )
        self.assertEqual(match_res.status_code, status.HTTP_200_OK)
        self.assertEqual(match_res.data["status"], "matched")

        recon_res = self.client.post(
            f"/api/v1/banking/companies/{self.company.id}/reconciliations/",
            {
                "bank_account": bank_account_id,
                "start_date": "2026-02-01",
                "end_date": "2026-02-28",
                "opening_balance": "0.00",
                "closing_balance": "50.00",
            },
            format="json",
        )
        self.assertEqual(recon_res.status_code, status.HTTP_201_CREATED)
        reconciliation_id = recon_res.data["id"]

        lines_res = self.client.put(
            f"/api/v1/banking/companies/{self.company.id}/reconciliations/{reconciliation_id}/lines/",
            {"transaction_ids": [transaction_id]},
            format="json",
        )
        self.assertEqual(lines_res.status_code, status.HTTP_200_OK)

        finalize_res = self.client.post(
            f"/api/v1/banking/companies/{self.company.id}/reconciliations/{reconciliation_id}/finalize/",
            {},
            format="json",
        )
        self.assertEqual(finalize_res.status_code, status.HTTP_200_OK)
        self.assertEqual(finalize_res.data["status"], "finalized")

        tx_after = self.client.get(f"/api/v1/banking/companies/{self.company.id}/transactions/")
        self.assertEqual(tx_after.data[0]["status"], "reconciled")

    def test_cross_tenant_banking_access_denied(self):
        bank_account_id = self._create_bank_account()
        self.client.force_authenticate(user=self.other_owner)
        response = self.client.get(f"/api/v1/banking/companies/{self.company.id}/bank-accounts/{bank_account_id}/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_bank_account_delete_without_dependencies(self):
        bank_account_id = self._create_bank_account()
        response = self.client.delete(f"/api/v1/banking/companies/{self.company.id}/bank-accounts/{bank_account_id}/")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_bank_account_delete_blocked_when_dependencies_exist(self):
        bank_account_id = self._create_bank_account()
        self.client.post(
            f"/api/v1/banking/companies/{self.company.id}/imports/",
            {
                "bank_account": bank_account_id,
                "file_name": "statement.csv",
                "raw_content": "date,description,amount,reference\n2026-02-20,Deposit,50.00,REF1",
            },
            format="json",
        )
        response = self.client.delete(f"/api/v1/banking/companies/{self.company.id}/bank-accounts/{bank_account_id}/")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
