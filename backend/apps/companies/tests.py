from datetime import timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.audit.models import AuditEvent
from apps.companies.models import CompanyInvitation, CompanyMember, CompanyMemberStatus
from apps.companies.services import create_company_for_user
from apps.rbac.constants import ROLE_ACCOUNTANT, ROLE_ADMIN, ROLE_OWNER, ROLE_VIEWER
from apps.rbac.models import CompanyRole, CompanyRoleAssignment
from apps.users.models import User


class CompanyIsolationTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="owner-tenant@test.local",
            password="SecurePass@123",
            full_name="Owner Tenant",
        )
        self.other_user = User.objects.create_user(
            email="other-tenant@test.local",
            password="SecurePass@123",
            full_name="Other Tenant",
        )
        self.company = create_company_for_user(
            user=self.owner,
            company_data={
                "name": "Tenant One",
                "slug": "tenant-one",
                "base_currency": "USD",
                "timezone": "UTC",
                "fiscal_year_start_month": 1,
                "is_active": True,
            },
        )

    def test_non_member_cannot_access_company(self):
        self.client.force_authenticate(user=self.other_user)
        response = self.client.get(f"/api/v1/companies/{self.company.id}/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_member_can_access_company(self):
        self.client.force_authenticate(user=self.owner)
        response = self.client.get(f"/api/v1/companies/{self.company.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["slug"], "tenant-one")


class CompanyInvitationTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="invite-owner@test.local",
            password="SecurePass@123",
            full_name="Invite Owner",
        )
        self.invited_user = User.objects.create_user(
            email="invite-user@test.local",
            password="SecurePass@123",
            full_name="Invite User",
        )
        self.company = create_company_for_user(
            user=self.owner,
            company_data={
                "name": "Invite Co",
                "slug": "invite-co",
                "base_currency": "USD",
                "timezone": "UTC",
                "fiscal_year_start_month": 1,
                "is_active": True,
            },
        )

    def test_invitation_accept_creates_active_membership(self):
        invitation = CompanyInvitation.objects.create(
            company=self.company,
            email=self.invited_user.email,
            invited_by_user=self.owner,
            expires_at=timezone.now() + timedelta(days=2),
        )

        self.client.force_authenticate(user=self.invited_user)
        response = self.client.post(
            "/api/v1/companies/members/invite/accept/",
            {"token": str(invitation.token)},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        membership = CompanyMember.objects.get(company=self.company, user=self.invited_user)
        self.assertEqual(membership.status, CompanyMemberStatus.ACTIVE)

    def test_invitation_accept_rejects_email_mismatch(self):
        other_user = User.objects.create_user(
            email="wrong-user@test.local",
            password="SecurePass@123",
            full_name="Wrong User",
        )
        invitation = CompanyInvitation.objects.create(
            company=self.company,
            email=self.invited_user.email,
            invited_by_user=self.owner,
            expires_at=timezone.now() + timedelta(days=2),
        )

        self.client.force_authenticate(user=other_user)
        response = self.client.post(
            "/api/v1/companies/members/invite/accept/",
            {"token": str(invitation.token)},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class CompanyMemberRolesUpdateTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="roles-owner@test.local",
            password="SecurePass@123",
            full_name="Roles Owner",
        )
        self.admin_user = User.objects.create_user(
            email="roles-admin@test.local",
            password="SecurePass@123",
            full_name="Roles Admin",
        )
        self.viewer_user = User.objects.create_user(
            email="roles-viewer@test.local",
            password="SecurePass@123",
            full_name="Roles Viewer",
        )
        self.target_user = User.objects.create_user(
            email="roles-target@test.local",
            password="SecurePass@123",
            full_name="Roles Target",
        )
        self.company = create_company_for_user(
            user=self.owner,
            company_data={
                "name": "Roles Company",
                "slug": "roles-company",
                "base_currency": "USD",
                "timezone": "UTC",
                "fiscal_year_start_month": 1,
                "is_active": True,
            },
        )
        self.url = f"/api/v1/companies/{self.company.id}/members/{self.target_user.id}/roles/"

        self.admin_role = CompanyRole.objects.get(company=self.company, name=ROLE_ADMIN)
        self.viewer_role = CompanyRole.objects.get(company=self.company, name=ROLE_VIEWER)
        self.accountant_role = CompanyRole.objects.get(company=self.company, name=ROLE_ACCOUNTANT)

        CompanyMember.objects.create(
            company=self.company,
            user=self.admin_user,
            status=CompanyMemberStatus.ACTIVE,
        )
        CompanyRoleAssignment.objects.create(
            company=self.company,
            user=self.admin_user,
            role=self.admin_role,
        )

        CompanyMember.objects.create(
            company=self.company,
            user=self.viewer_user,
            status=CompanyMemberStatus.ACTIVE,
        )
        CompanyRoleAssignment.objects.create(
            company=self.company,
            user=self.viewer_user,
            role=self.viewer_role,
        )

        CompanyMember.objects.create(
            company=self.company,
            user=self.target_user,
            status=CompanyMemberStatus.ACTIVE,
        )
        CompanyRoleAssignment.objects.create(
            company=self.company,
            user=self.target_user,
            role=self.viewer_role,
        )

    def test_admin_can_replace_member_roles_and_writes_audit(self):
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.patch(self.url, {"roles": [ROLE_ACCOUNTANT, ROLE_ADMIN]}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["roles"], [ROLE_ACCOUNTANT, ROLE_ADMIN])

        assigned_roles = sorted(
            CompanyRoleAssignment.objects.filter(company=self.company, user=self.target_user).values_list(
                "role__name", flat=True
            )
        )
        self.assertEqual(assigned_roles, [ROLE_ACCOUNTANT, ROLE_ADMIN])

        audit = AuditEvent.objects.filter(
            company=self.company,
            action="member.roles.replace",
            entity_type="company_member",
        ).latest("created_at")
        self.assertEqual(audit.metadata["target_user_id"], str(self.target_user.id))
        self.assertEqual(sorted(audit.metadata["before_roles"]), [ROLE_VIEWER])
        self.assertEqual(sorted(audit.metadata["after_roles"]), [ROLE_ACCOUNTANT, ROLE_ADMIN])

    def test_viewer_cannot_replace_member_roles(self):
        self.client.force_authenticate(user=self.viewer_user)
        response = self.client.patch(self.url, {"roles": [ROLE_ADMIN]}, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_owner_role_cannot_be_mutated_from_company_endpoint(self):
        self.client.force_authenticate(user=self.admin_user)
        owner_url = f"/api/v1/companies/{self.company.id}/members/{self.owner.id}/roles/"
        response = self.client.patch(owner_url, {"roles": [ROLE_ADMIN]}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        owner_roles = sorted(
            CompanyRoleAssignment.objects.filter(company=self.company, user=self.owner).values_list("role__name", flat=True)
        )
        self.assertIn(ROLE_OWNER, owner_roles)

    def test_invalid_role_payload_returns_bad_request(self):
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.patch(self.url, {"roles": ["BadRole"]}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_empty_roles_payload_returns_bad_request(self):
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.patch(self.url, {"roles": []}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
