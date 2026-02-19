from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounting.models import Account
from apps.companies.services import create_company_for_user
from apps.contacts.models import Contact
from apps.journals.models import JournalEntry, JournalStatus
from apps.purchases.models import Bill
from apps.users.models import User


class PurchasesApiTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="purchase-owner@test.local",
            password="SecurePass@123",
            full_name="Purchase Owner",
        )
        self.other_owner = User.objects.create_user(
            email="purchase-other-owner@test.local",
            password="SecurePass@123",
            full_name="Purchase Other Owner",
        )
        self.company = create_company_for_user(
            user=self.owner,
            company_data={
                "name": "Purchases Co",
                "slug": "purchases-co",
                "base_currency": "USD",
                "timezone": "UTC",
                "fiscal_year_start_month": 1,
                "is_active": True,
            },
        )
        self.other_company = create_company_for_user(
            user=self.other_owner,
            company_data={
                "name": "Other Purchases Co",
                "slug": "other-purchases-co",
                "base_currency": "USD",
                "timezone": "UTC",
                "fiscal_year_start_month": 1,
                "is_active": True,
            },
        )

        self.ap_account = Account.objects.create(
            company=self.company, code="2000", name="Accounts Payable", type="liability", normal_balance="credit"
        )
        self.cash_account = Account.objects.create(
            company=self.company, code="1000", name="Cash", type="asset", normal_balance="debit"
        )
        self.expense_account = Account.objects.create(
            company=self.company, code="5000", name="Expense", type="expense", normal_balance="debit"
        )

        self.vendor = Contact.objects.create(
            company=self.company,
            type="vendor",
            name="Vendor One",
            email="vendor1@example.com",
        )

    def _create_bill_with_lines(self):
        self.client.force_authenticate(user=self.owner)
        bill_res = self.client.post(
            f"/api/v1/purchases/companies/{self.company.id}/bills/",
            {
                "vendor": str(self.vendor.id),
                "bill_date": "2026-02-19",
                "due_date": "2026-03-19",
                "currency_code": "USD",
                "notes": "Test bill",
                "ap_account": str(self.ap_account.id),
            },
            format="json",
        )
        self.assertEqual(bill_res.status_code, status.HTTP_201_CREATED)
        bill_id = bill_res.data["id"]

        lines_res = self.client.put(
            f"/api/v1/purchases/companies/{self.company.id}/bills/{bill_id}/lines/",
            {
                "lines": [
                    {
                        "description": "Service Cost",
                        "quantity": "1",
                        "unit_cost": "120.00",
                        "expense_account_id": str(self.expense_account.id),
                    }
                ]
            },
            format="json",
        )
        self.assertEqual(lines_res.status_code, status.HTTP_200_OK)
        return bill_id

    def test_bill_post_creates_posted_journal(self):
        bill_id = self._create_bill_with_lines()
        post_res = self.client.post(
            f"/api/v1/purchases/companies/{self.company.id}/bills/{bill_id}/post/",
            {},
            format="json",
        )
        self.assertEqual(post_res.status_code, status.HTTP_200_OK)

        bill = Bill.objects.get(id=bill_id)
        self.assertIsNotNone(bill.journal_entry_id)
        journal = JournalEntry.objects.get(id=bill.journal_entry_id)
        self.assertEqual(journal.status, JournalStatus.POSTED)
        self.assertEqual(journal.lines.count(), 2)

    def test_vendor_payment_post_updates_bill_paid_amount(self):
        bill_id = self._create_bill_with_lines()
        self.client.post(f"/api/v1/purchases/companies/{self.company.id}/bills/{bill_id}/post/", {}, format="json")

        payment_res = self.client.post(
            f"/api/v1/purchases/companies/{self.company.id}/vendor-payments/",
            {
                "vendor": str(self.vendor.id),
                "paid_date": "2026-02-20",
                "amount": "120.00",
                "currency_code": "USD",
                "payment_account": str(self.cash_account.id),
            },
            format="json",
            HTTP_IDEMPOTENCY_KEY="vendor-payment-create-1",
        )
        self.assertEqual(payment_res.status_code, status.HTTP_201_CREATED)
        payment_id = payment_res.data["id"]

        alloc_res = self.client.put(
            f"/api/v1/purchases/companies/{self.company.id}/vendor-payments/{payment_id}/allocations/",
            {"allocations": [{"bill_id": str(bill_id), "amount": "120.00"}]},
            format="json",
        )
        self.assertEqual(alloc_res.status_code, status.HTTP_200_OK)

        post_res = self.client.post(
            f"/api/v1/purchases/companies/{self.company.id}/vendor-payments/{payment_id}/post/",
            {},
            format="json",
            HTTP_IDEMPOTENCY_KEY="vendor-payment-post-1",
        )
        self.assertEqual(post_res.status_code, status.HTTP_200_OK)

        bill = Bill.objects.get(id=bill_id)
        self.assertEqual(str(bill.amount_paid), "120.0000")
        self.assertEqual(bill.status, "paid")

    def test_vendor_payment_allocation_cannot_exceed_open_balance(self):
        bill_id = self._create_bill_with_lines()
        self.client.post(f"/api/v1/purchases/companies/{self.company.id}/bills/{bill_id}/post/", {}, format="json")

        payment_res = self.client.post(
            f"/api/v1/purchases/companies/{self.company.id}/vendor-payments/",
            {
                "vendor": str(self.vendor.id),
                "paid_date": "2026-02-20",
                "amount": "200.00",
                "currency_code": "USD",
                "payment_account": str(self.cash_account.id),
            },
            format="json",
            HTTP_IDEMPOTENCY_KEY="vendor-payment-create-2",
        )
        payment_id = payment_res.data["id"]

        alloc_res = self.client.put(
            f"/api/v1/purchases/companies/{self.company.id}/vendor-payments/{payment_id}/allocations/",
            {"allocations": [{"bill_id": str(bill_id), "amount": "180.00"}]},
            format="json",
        )
        self.assertEqual(alloc_res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_vendor_payment_post_idempotency_prevents_double_apply(self):
        bill_id = self._create_bill_with_lines()
        self.client.post(f"/api/v1/purchases/companies/{self.company.id}/bills/{bill_id}/post/", {}, format="json")
        payment_res = self.client.post(
            f"/api/v1/purchases/companies/{self.company.id}/vendor-payments/",
            {
                "vendor": str(self.vendor.id),
                "paid_date": "2026-02-20",
                "amount": "120.00",
                "currency_code": "USD",
                "payment_account": str(self.cash_account.id),
            },
            format="json",
            HTTP_IDEMPOTENCY_KEY="vendor-payment-create-3",
        )
        payment_id = payment_res.data["id"]
        self.client.put(
            f"/api/v1/purchases/companies/{self.company.id}/vendor-payments/{payment_id}/allocations/",
            {"allocations": [{"bill_id": str(bill_id), "amount": "120.00"}]},
            format="json",
        )

        first = self.client.post(
            f"/api/v1/purchases/companies/{self.company.id}/vendor-payments/{payment_id}/post/",
            {},
            format="json",
            HTTP_IDEMPOTENCY_KEY="vendor-payment-post-3",
        )
        second = self.client.post(
            f"/api/v1/purchases/companies/{self.company.id}/vendor-payments/{payment_id}/post/",
            {},
            format="json",
            HTTP_IDEMPOTENCY_KEY="vendor-payment-post-3",
        )
        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        bill = Bill.objects.get(id=bill_id)
        self.assertEqual(str(bill.amount_paid), "120.0000")

    def test_cross_tenant_purchases_access_denied(self):
        bill_id = self._create_bill_with_lines()
        self.client.force_authenticate(user=self.other_owner)
        response = self.client.get(f"/api/v1/purchases/companies/{self.company.id}/bills/{bill_id}/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_bill_list_is_paginated(self):
        self._create_bill_with_lines()
        self._create_bill_with_lines()
        self.client.force_authenticate(user=self.owner)

        response = self.client.get(f"/api/v1/purchases/companies/{self.company.id}/bills/?page_size=1")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 2)
        self.assertEqual(len(response.data["results"]), 1)
