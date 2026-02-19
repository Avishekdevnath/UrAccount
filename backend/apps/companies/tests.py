from datetime import timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.companies.models import CompanyInvitation, CompanyMember, CompanyMemberStatus
from apps.companies.services import create_company_for_user
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
