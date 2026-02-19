from rest_framework import status
from rest_framework.test import APITestCase

from apps.companies.models import CompanyMember, CompanyMemberStatus
from apps.companies.services import create_company_for_user
from apps.rbac.constants import ROLE_VIEWER
from apps.rbac.models import CompanyRole, CompanyRoleAssignment
from apps.users.models import User


class AccountApiTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="acct-owner@test.local",
            password="SecurePass@123",
            full_name="Account Owner",
        )
        self.viewer = User.objects.create_user(
            email="acct-viewer@test.local",
            password="SecurePass@123",
            full_name="Account Viewer",
        )
        self.other_owner = User.objects.create_user(
            email="acct-other-owner@test.local",
            password="SecurePass@123",
            full_name="Other Owner",
        )

        self.company = create_company_for_user(
            user=self.owner,
            company_data={
                "name": "Accounting Co",
                "slug": "accounting-co",
                "base_currency": "USD",
                "timezone": "UTC",
                "fiscal_year_start_month": 1,
                "is_active": True,
            },
        )
        self.other_company = create_company_for_user(
            user=self.other_owner,
            company_data={
                "name": "Other Accounting Co",
                "slug": "other-accounting-co",
                "base_currency": "USD",
                "timezone": "UTC",
                "fiscal_year_start_month": 1,
                "is_active": True,
            },
        )

        CompanyMember.objects.create(company=self.company, user=self.viewer, status=CompanyMemberStatus.ACTIVE)
        viewer_role = CompanyRole.objects.get(company=self.company, name=ROLE_VIEWER)
        CompanyRoleAssignment.objects.create(company=self.company, user=self.viewer, role=viewer_role)

    def test_owner_can_create_account(self):
        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            f"/api/v1/accounting/companies/{self.company.id}/accounts/",
            {
                "code": "1000",
                "name": "Cash",
                "type": "asset",
                "normal_balance": "debit",
                "is_active": True,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_viewer_cannot_create_account(self):
        self.client.force_authenticate(user=self.viewer)
        response = self.client.post(
            f"/api/v1/accounting/companies/{self.company.id}/accounts/",
            {
                "code": "1001",
                "name": "Cash 2",
                "type": "asset",
                "normal_balance": "debit",
                "is_active": True,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_cross_tenant_account_access_denied(self):
        self.client.force_authenticate(user=self.owner)
        create_response = self.client.post(
            f"/api/v1/accounting/companies/{self.other_company.id}/accounts/",
            {
                "code": "2000",
                "name": "Other Cash",
                "type": "asset",
                "normal_balance": "debit",
                "is_active": True,
            },
            format="json",
        )
        self.assertEqual(create_response.status_code, status.HTTP_404_NOT_FOUND)
