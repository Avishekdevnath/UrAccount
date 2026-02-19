from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounting.models import Account
from apps.companies.services import create_company_for_user
from apps.users.models import User


class JournalApiTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="journal-owner@test.local",
            password="SecurePass@123",
            full_name="Journal Owner",
        )
        self.other_owner = User.objects.create_user(
            email="journal-other-owner@test.local",
            password="SecurePass@123",
            full_name="Journal Other Owner",
        )
        self.company = create_company_for_user(
            user=self.owner,
            company_data={
                "name": "Journal Co",
                "slug": "journal-co",
                "base_currency": "USD",
                "timezone": "UTC",
                "fiscal_year_start_month": 1,
                "is_active": True,
            },
        )
        self.other_company = create_company_for_user(
            user=self.other_owner,
            company_data={
                "name": "Other Journal Co",
                "slug": "other-journal-co",
                "base_currency": "USD",
                "timezone": "UTC",
                "fiscal_year_start_month": 1,
                "is_active": True,
            },
        )

        self.cash = Account.objects.create(
            company=self.company,
            code="1000",
            name="Cash",
            type="asset",
            normal_balance="debit",
        )
        self.revenue = Account.objects.create(
            company=self.company,
            code="4000",
            name="Revenue",
            type="income",
            normal_balance="credit",
        )

    def _create_draft_journal(self):
        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            f"/api/v1/journals/companies/{self.company.id}/journals/",
            {"entry_date": "2026-02-19", "description": "Test JE"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        return response.data["id"]

    def _replace_lines(self, journal_id, lines):
        response = self.client.put(
            f"/api/v1/journals/companies/{self.company.id}/journals/{journal_id}/lines/",
            {"lines": lines},
            format="json",
        )
        return response

    def test_post_requires_balanced_lines(self):
        journal_id = self._create_draft_journal()
        replace_response = self._replace_lines(
            journal_id,
            [
                {"account_id": str(self.cash.id), "debit": "100.00", "credit": "0.00"},
                {"account_id": str(self.revenue.id), "debit": "0.00", "credit": "90.00"},
            ],
        )
        self.assertEqual(replace_response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_posted_journal_is_immutable(self):
        journal_id = self._create_draft_journal()
        replace_response = self._replace_lines(
            journal_id,
            [
                {"account_id": str(self.cash.id), "debit": "100.00", "credit": "0.00"},
                {"account_id": str(self.revenue.id), "debit": "0.00", "credit": "100.00"},
            ],
        )
        self.assertEqual(replace_response.status_code, status.HTTP_200_OK)

        post_response = self.client.post(
            f"/api/v1/journals/companies/{self.company.id}/journals/{journal_id}/post/",
            {},
            format="json",
        )
        self.assertEqual(post_response.status_code, status.HTTP_200_OK)

        patch_response = self.client.patch(
            f"/api/v1/journals/companies/{self.company.id}/journals/{journal_id}/",
            {"description": "Changed"},
            format="json",
        )
        self.assertEqual(patch_response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_void_creates_reversal(self):
        journal_id = self._create_draft_journal()
        self._replace_lines(
            journal_id,
            [
                {"account_id": str(self.cash.id), "debit": "50.00", "credit": "0.00"},
                {"account_id": str(self.revenue.id), "debit": "0.00", "credit": "50.00"},
            ],
        )
        self.client.post(
            f"/api/v1/journals/companies/{self.company.id}/journals/{journal_id}/post/",
            {},
            format="json",
        )

        void_response = self.client.post(
            f"/api/v1/journals/companies/{self.company.id}/journals/{journal_id}/void/",
            {},
            format="json",
        )
        self.assertEqual(void_response.status_code, status.HTTP_200_OK)
        self.assertIn("reversal_id", void_response.data)

    def test_sequence_increments_per_company(self):
        first_id = self._create_draft_journal()
        self._replace_lines(
            first_id,
            [
                {"account_id": str(self.cash.id), "debit": "10.00", "credit": "0.00"},
                {"account_id": str(self.revenue.id), "debit": "0.00", "credit": "10.00"},
            ],
        )
        first_post = self.client.post(
            f"/api/v1/journals/companies/{self.company.id}/journals/{first_id}/post/",
            {},
            format="json",
        )
        self.assertEqual(first_post.status_code, status.HTTP_200_OK)

        second_id = self._create_draft_journal()
        self._replace_lines(
            second_id,
            [
                {"account_id": str(self.cash.id), "debit": "20.00", "credit": "0.00"},
                {"account_id": str(self.revenue.id), "debit": "0.00", "credit": "20.00"},
            ],
        )
        second_post = self.client.post(
            f"/api/v1/journals/companies/{self.company.id}/journals/{second_id}/post/",
            {},
            format="json",
        )
        self.assertEqual(second_post.status_code, status.HTTP_200_OK)
        self.assertGreater(second_post.data["entry_no"], first_post.data["entry_no"])

    def test_cross_tenant_journal_access_denied(self):
        journal_id = self._create_draft_journal()
        self.client.force_authenticate(user=self.other_owner)
        response = self.client.get(f"/api/v1/journals/companies/{self.company.id}/journals/{journal_id}/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_journal_list_is_paginated(self):
        self._create_draft_journal()
        self._create_draft_journal()
        self.client.force_authenticate(user=self.owner)

        response = self.client.get(f"/api/v1/journals/companies/{self.company.id}/journals/?page_size=1")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 2)
        self.assertEqual(len(response.data["results"]), 1)
