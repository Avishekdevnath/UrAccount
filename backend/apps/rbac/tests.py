from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounting.models import Account
from apps.companies.models import CompanyMember, CompanyMemberStatus
from apps.companies.services import create_company_for_user
from apps.rbac.constants import ROLE_ACCOUNTANT, ROLE_ADMIN, ROLE_VIEWER
from apps.rbac.models import CompanyRole, CompanyRoleAssignment
from apps.users.models import User


class RBACPermissionTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="rbac-owner@test.local",
            password="SecurePass@123",
            full_name="RBAC Owner",
        )
        self.viewer = User.objects.create_user(
            email="rbac-viewer@test.local",
            password="SecurePass@123",
            full_name="RBAC Viewer",
        )

        self.company = create_company_for_user(
            user=self.owner,
            company_data={
                "name": "RBAC Co",
                "slug": "rbac-co",
                "base_currency": "USD",
                "timezone": "UTC",
                "fiscal_year_start_month": 1,
                "is_active": True,
            },
        )

        CompanyMember.objects.create(
            company=self.company,
            user=self.viewer,
            status=CompanyMemberStatus.ACTIVE,
        )
        viewer_role = CompanyRole.objects.get(company=self.company, name=ROLE_VIEWER)
        CompanyRoleAssignment.objects.create(company=self.company, user=self.viewer, role=viewer_role)

    def test_viewer_cannot_update_company(self):
        self.client.force_authenticate(user=self.viewer)
        response = self.client.patch(
            f"/api/v1/companies/{self.company.id}/",
            {"name": "Updated by viewer"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_owner_can_update_company(self):
        self.client.force_authenticate(user=self.owner)
        response = self.client.patch(
            f"/api/v1/companies/{self.company.id}/",
            {"name": "Updated by owner"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["name"], "Updated by owner")

    def test_my_permissions_endpoint_is_member_scoped(self):
        self.client.force_authenticate(user=self.viewer)
        response = self.client.get(f"/api/v1/rbac/companies/{self.company.id}/me/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn(ROLE_VIEWER, response.data["roles"])

    def test_viewer_cannot_assign_roles(self):
        self.client.force_authenticate(user=self.viewer)
        admin_role = CompanyRole.objects.get(company=self.company, name=ROLE_ADMIN)
        response = self.client.post(
            f"/api/v1/rbac/companies/{self.company.id}/roles/assign/",
            {"user_id": str(self.viewer.id), "role_id": str(admin_role.id)},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_owner_can_assign_role_to_member(self):
        self.client.force_authenticate(user=self.owner)
        admin_role = CompanyRole.objects.get(company=self.company, name=ROLE_ADMIN)
        response = self.client.post(
            f"/api/v1/rbac/companies/{self.company.id}/roles/assign/",
            {"user_id": str(self.viewer.id), "role_id": str(admin_role.id)},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_user_cannot_access_other_company_permissions(self):
        other_owner = User.objects.create_user(
            email="other-owner@test.local",
            password="SecurePass@123",
            full_name="Other Owner",
        )
        other_company = create_company_for_user(
            user=other_owner,
            company_data={
                "name": "Other Co",
                "slug": "other-co",
                "base_currency": "USD",
                "timezone": "UTC",
                "fiscal_year_start_month": 1,
                "is_active": True,
            },
        )
        self.client.force_authenticate(user=self.viewer)
        response = self.client.get(f"/api/v1/rbac/companies/{other_company.id}/me/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class RBACRoleMatrixTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="matrix-owner@test.local",
            password="SecurePass@123",
            full_name="Matrix Owner",
        )
        self.admin = User.objects.create_user(
            email="matrix-admin@test.local",
            password="SecurePass@123",
            full_name="Matrix Admin",
        )
        self.accountant = User.objects.create_user(
            email="matrix-accountant@test.local",
            password="SecurePass@123",
            full_name="Matrix Accountant",
        )
        self.viewer = User.objects.create_user(
            email="matrix-viewer@test.local",
            password="SecurePass@123",
            full_name="Matrix Viewer",
        )

        self.company = create_company_for_user(
            user=self.owner,
            company_data={
                "name": "Matrix Co",
                "slug": "matrix-co",
                "base_currency": "USD",
                "timezone": "UTC",
                "fiscal_year_start_month": 1,
                "is_active": True,
            },
        )
        for user in (self.admin, self.accountant, self.viewer):
            CompanyMember.objects.create(company=self.company, user=user, status=CompanyMemberStatus.ACTIVE)

        admin_role = CompanyRole.objects.get(company=self.company, name=ROLE_ADMIN)
        accountant_role = CompanyRole.objects.get(company=self.company, name=ROLE_ACCOUNTANT)
        viewer_role = CompanyRole.objects.get(company=self.company, name=ROLE_VIEWER)
        CompanyRoleAssignment.objects.create(company=self.company, user=self.admin, role=admin_role)
        CompanyRoleAssignment.objects.create(company=self.company, user=self.accountant, role=accountant_role)
        CompanyRoleAssignment.objects.create(company=self.company, user=self.viewer, role=viewer_role)

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
        create_res = self.client.post(
            f"/api/v1/journals/companies/{self.company.id}/journals/",
            {"entry_date": "2026-02-19", "description": "Role matrix JE"},
            format="json",
        )
        self.assertEqual(create_res.status_code, status.HTTP_201_CREATED)
        journal_id = create_res.data["id"]

        lines_res = self.client.put(
            f"/api/v1/journals/companies/{self.company.id}/journals/{journal_id}/lines/",
            {
                "lines": [
                    {"account_id": str(self.cash.id), "debit": "100.00", "credit": "0.00"},
                    {"account_id": str(self.revenue.id), "debit": "0.00", "credit": "100.00"},
                ]
            },
            format="json",
        )
        self.assertEqual(lines_res.status_code, status.HTTP_200_OK)
        return journal_id

    def test_company_manage_permission_matrix(self):
        cases = [
            (self.owner, status.HTTP_200_OK),
            (self.admin, status.HTTP_200_OK),
            (self.accountant, status.HTTP_403_FORBIDDEN),
            (self.viewer, status.HTTP_403_FORBIDDEN),
        ]
        for user, expected in cases:
            self.client.force_authenticate(user=user)
            res = self.client.patch(
                f"/api/v1/companies/{self.company.id}/",
                {"name": f"Matrix Co - {user.email}"},
                format="json",
            )
            self.assertEqual(res.status_code, expected)

    def test_accounting_post_permission_matrix(self):
        post_allowed = [self.owner, self.admin, self.accountant]
        for user in post_allowed:
            journal_id = self._create_draft_journal()
            self.client.force_authenticate(user=user)
            res = self.client.post(
                f"/api/v1/journals/companies/{self.company.id}/journals/{journal_id}/post/",
                {},
                format="json",
            )
            self.assertEqual(res.status_code, status.HTTP_200_OK)

        viewer_journal_id = self._create_draft_journal()
        self.client.force_authenticate(user=self.viewer)
        viewer_res = self.client.post(
            f"/api/v1/journals/companies/{self.company.id}/journals/{viewer_journal_id}/post/",
            {},
            format="json",
        )
        self.assertEqual(viewer_res.status_code, status.HTTP_403_FORBIDDEN)
