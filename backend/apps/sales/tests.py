from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounting.models import Account
from apps.companies.services import create_company_for_user
from apps.contacts.models import Contact
from apps.journals.models import JournalEntry, JournalStatus
from apps.sales.models import Invoice
from apps.users.models import User


class SalesApiTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="sales-owner@test.local",
            password="SecurePass@123",
            full_name="Sales Owner",
        )
        self.other_owner = User.objects.create_user(
            email="sales-other-owner@test.local",
            password="SecurePass@123",
            full_name="Sales Other Owner",
        )
        self.company = create_company_for_user(
            user=self.owner,
            company_data={
                "name": "Sales Co",
                "slug": "sales-co",
                "base_currency": "USD",
                "timezone": "UTC",
                "fiscal_year_start_month": 1,
                "is_active": True,
            },
        )
        self.other_company = create_company_for_user(
            user=self.other_owner,
            company_data={
                "name": "Other Sales Co",
                "slug": "other-sales-co",
                "base_currency": "USD",
                "timezone": "UTC",
                "fiscal_year_start_month": 1,
                "is_active": True,
            },
        )

        self.ar_account = Account.objects.create(
            company=self.company, code="1100", name="Accounts Receivable", type="asset", normal_balance="debit"
        )
        self.cash_account = Account.objects.create(
            company=self.company, code="1000", name="Cash", type="asset", normal_balance="debit"
        )
        self.revenue_account = Account.objects.create(
            company=self.company, code="4000", name="Revenue", type="income", normal_balance="credit"
        )

        self.customer = Contact.objects.create(
            company=self.company,
            type="customer",
            name="Customer One",
            email="customer1@example.com",
        )

    def _create_invoice_with_lines(self):
        self.client.force_authenticate(user=self.owner)
        invoice_res = self.client.post(
            f"/api/v1/sales/companies/{self.company.id}/invoices/",
            {
                "customer": str(self.customer.id),
                "issue_date": "2026-02-19",
                "due_date": "2026-03-19",
                "currency_code": "USD",
                "notes": "Test invoice",
                "ar_account": str(self.ar_account.id),
            },
            format="json",
        )
        self.assertEqual(invoice_res.status_code, status.HTTP_201_CREATED)
        invoice_id = invoice_res.data["id"]

        lines_res = self.client.put(
            f"/api/v1/sales/companies/{self.company.id}/invoices/{invoice_id}/lines/",
            {
                "lines": [
                    {
                        "description": "Service Fee",
                        "quantity": "1",
                        "unit_price": "120.00",
                        "revenue_account_id": str(self.revenue_account.id),
                    }
                ]
            },
            format="json",
        )
        self.assertEqual(lines_res.status_code, status.HTTP_200_OK)
        return invoice_id

    def test_invoice_post_creates_posted_journal(self):
        invoice_id = self._create_invoice_with_lines()
        post_res = self.client.post(
            f"/api/v1/sales/companies/{self.company.id}/invoices/{invoice_id}/post/",
            {},
            format="json",
        )
        self.assertEqual(post_res.status_code, status.HTTP_200_OK)

        invoice = Invoice.objects.get(id=invoice_id)
        self.assertIsNotNone(invoice.journal_entry_id)
        journal = JournalEntry.objects.get(id=invoice.journal_entry_id)
        self.assertEqual(journal.status, JournalStatus.POSTED)
        self.assertEqual(journal.lines.count(), 2)

    def test_receipt_post_updates_invoice_paid_amount(self):
        invoice_id = self._create_invoice_with_lines()
        self.client.post(f"/api/v1/sales/companies/{self.company.id}/invoices/{invoice_id}/post/", {}, format="json")

        receipt_res = self.client.post(
            f"/api/v1/sales/companies/{self.company.id}/receipts/",
            {
                "customer": str(self.customer.id),
                "received_date": "2026-02-20",
                "amount": "120.00",
                "currency_code": "USD",
                "deposit_account": str(self.cash_account.id),
            },
            format="json",
            HTTP_IDEMPOTENCY_KEY="receipt-create-1",
        )
        self.assertEqual(receipt_res.status_code, status.HTTP_201_CREATED)
        receipt_id = receipt_res.data["id"]

        alloc_res = self.client.put(
            f"/api/v1/sales/companies/{self.company.id}/receipts/{receipt_id}/allocations/",
            {"allocations": [{"invoice_id": str(invoice_id), "amount": "120.00"}]},
            format="json",
        )
        self.assertEqual(alloc_res.status_code, status.HTTP_200_OK)

        post_res = self.client.post(
            f"/api/v1/sales/companies/{self.company.id}/receipts/{receipt_id}/post/",
            {},
            format="json",
            HTTP_IDEMPOTENCY_KEY="receipt-post-1",
        )
        self.assertEqual(post_res.status_code, status.HTTP_200_OK)

        invoice = Invoice.objects.get(id=invoice_id)
        self.assertEqual(str(invoice.amount_paid), "120.0000")
        self.assertEqual(invoice.status, "paid")

    def test_receipt_allocation_cannot_exceed_open_balance(self):
        invoice_id = self._create_invoice_with_lines()
        self.client.post(f"/api/v1/sales/companies/{self.company.id}/invoices/{invoice_id}/post/", {}, format="json")

        receipt_res = self.client.post(
            f"/api/v1/sales/companies/{self.company.id}/receipts/",
            {
                "customer": str(self.customer.id),
                "received_date": "2026-02-20",
                "amount": "200.00",
                "currency_code": "USD",
                "deposit_account": str(self.cash_account.id),
            },
            format="json",
            HTTP_IDEMPOTENCY_KEY="receipt-create-2",
        )
        receipt_id = receipt_res.data["id"]

        alloc_res = self.client.put(
            f"/api/v1/sales/companies/{self.company.id}/receipts/{receipt_id}/allocations/",
            {"allocations": [{"invoice_id": str(invoice_id), "amount": "180.00"}]},
            format="json",
        )
        self.assertEqual(alloc_res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_receipt_post_idempotency_prevents_double_apply(self):
        invoice_id = self._create_invoice_with_lines()
        self.client.post(f"/api/v1/sales/companies/{self.company.id}/invoices/{invoice_id}/post/", {}, format="json")
        receipt_res = self.client.post(
            f"/api/v1/sales/companies/{self.company.id}/receipts/",
            {
                "customer": str(self.customer.id),
                "received_date": "2026-02-20",
                "amount": "120.00",
                "currency_code": "USD",
                "deposit_account": str(self.cash_account.id),
            },
            format="json",
            HTTP_IDEMPOTENCY_KEY="receipt-create-3",
        )
        receipt_id = receipt_res.data["id"]
        self.client.put(
            f"/api/v1/sales/companies/{self.company.id}/receipts/{receipt_id}/allocations/",
            {"allocations": [{"invoice_id": str(invoice_id), "amount": "120.00"}]},
            format="json",
        )

        first = self.client.post(
            f"/api/v1/sales/companies/{self.company.id}/receipts/{receipt_id}/post/",
            {},
            format="json",
            HTTP_IDEMPOTENCY_KEY="receipt-post-3",
        )
        second = self.client.post(
            f"/api/v1/sales/companies/{self.company.id}/receipts/{receipt_id}/post/",
            {},
            format="json",
            HTTP_IDEMPOTENCY_KEY="receipt-post-3",
        )
        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        invoice = Invoice.objects.get(id=invoice_id)
        self.assertEqual(str(invoice.amount_paid), "120.0000")

    def test_cross_tenant_sales_access_denied(self):
        invoice_id = self._create_invoice_with_lines()
        self.client.force_authenticate(user=self.other_owner)
        response = self.client.get(f"/api/v1/sales/companies/{self.company.id}/invoices/{invoice_id}/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_invoice_list_is_paginated(self):
        self._create_invoice_with_lines()
        self._create_invoice_with_lines()
        self.client.force_authenticate(user=self.owner)

        response = self.client.get(f"/api/v1/sales/companies/{self.company.id}/invoices/?page_size=1")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 2)
        self.assertEqual(len(response.data["results"]), 1)
