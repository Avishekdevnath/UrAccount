from django.core.management import call_command
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounting.models import Account
from apps.banking.models import BankReconciliation, BankTransaction
from apps.companies.models import Company
from apps.contacts.models import Contact
from apps.purchases.models import Bill, VendorPayment
from apps.sales.models import Invoice, Receipt
from apps.system_admin.models import SystemRole
from apps.users.demo_seed import (
    DEMO_BILL_NOTE,
    DEMO_INVOICE_NOTE,
    DEMO_RECEIPT_NOTE,
    DEMO_SYSTEM_ADMIN_EMAIL,
    DEMO_VENDOR_PAYMENT_NOTE,
)
from apps.users.models import User


class AuthApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="auth-user@test.local",
            password="SecurePass@123",
            full_name="Auth User",
        )

    def test_login_returns_tokens(self):
        response = self.client.post(
            "/api/v1/auth/login/",
            {"email": self.user.email, "password": "SecurePass@123"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

    def test_me_returns_authenticated_user(self):
        login_response = self.client.post(
            "/api/v1/auth/login/",
            {"email": self.user.email, "password": "SecurePass@123"},
            format="json",
        )
        access_token = login_response.data["access"]

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token}")
        response = self.client.get("/api/v1/auth/me/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["email"], self.user.email)
        self.assertTrue(response.data["is_active"])

    def test_logout_requires_auth_and_returns_ok(self):
        unauth_response = self.client.post("/api/v1/auth/logout/", {}, format="json")
        self.assertEqual(unauth_response.status_code, status.HTTP_401_UNAUTHORIZED)

        login_response = self.client.post(
            "/api/v1/auth/login/",
            {"email": self.user.email, "password": "SecurePass@123"},
            format="json",
        )
        access_token = login_response.data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token}")
        auth_response = self.client.post("/api/v1/auth/logout/", {}, format="json")
        self.assertEqual(auth_response.status_code, status.HTTP_200_OK)


class DemoSeedCommandTests(TestCase):
    def test_seed_demo_accounts_command_is_idempotent(self):
        call_command("seed_demo_accounts")
        call_command("seed_demo_accounts")

        company = Company.objects.get(slug="demo-company")
        self.assertEqual(Account.objects.filter(company=company).count(), 6)
        self.assertGreaterEqual(Contact.objects.filter(company=company).count(), 2)
        self.assertEqual(Invoice.objects.filter(company=company, notes=DEMO_INVOICE_NOTE).count(), 1)
        self.assertEqual(Receipt.objects.filter(company=company, notes=DEMO_RECEIPT_NOTE).count(), 1)
        self.assertEqual(Bill.objects.filter(company=company, notes=DEMO_BILL_NOTE).count(), 1)
        self.assertEqual(VendorPayment.objects.filter(company=company, notes=DEMO_VENDOR_PAYMENT_NOTE).count(), 1)
        self.assertGreaterEqual(BankTransaction.objects.filter(company=company).count(), 1)
        self.assertEqual(BankReconciliation.objects.filter(company=company).count(), 1)
        system_admin = User.objects.get(email=DEMO_SYSTEM_ADMIN_EMAIL)
        self.assertTrue(system_admin.is_staff)
        self.assertTrue(SystemRole.objects.filter(user=system_admin, role=SystemRole.ROLE_SUPER_ADMIN).exists())
