from rest_framework import status
from rest_framework.test import APITestCase

from apps.companies.models import CompanyMember, CompanyMemberStatus
from apps.companies.services import create_company_for_user
from apps.contacts.models import Contact
from apps.rbac.constants import ROLE_VIEWER
from apps.rbac.models import CompanyRole, CompanyRoleAssignment
from apps.users.models import User


class ContactApiTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="contact-owner@test.local",
            password="SecurePass@123",
            full_name="Contact Owner",
        )
        self.viewer = User.objects.create_user(
            email="contact-viewer@test.local",
            password="SecurePass@123",
            full_name="Contact Viewer",
        )
        self.company = create_company_for_user(
            user=self.owner,
            company_data={
                "name": "Contact Co",
                "slug": "contact-co",
                "base_currency": "USD",
                "timezone": "UTC",
                "fiscal_year_start_month": 1,
                "is_active": True,
            },
        )
        CompanyMember.objects.create(company=self.company, user=self.viewer, status=CompanyMemberStatus.ACTIVE)
        viewer_role = CompanyRole.objects.get(company=self.company, name=ROLE_VIEWER)
        CompanyRoleAssignment.objects.create(company=self.company, user=self.viewer, role=viewer_role)

    def test_owner_can_create_customer_contact(self):
        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            f"/api/v1/contacts/companies/{self.company.id}/contacts/",
            {"type": "customer", "name": "Acme Customer", "email": "acme@example.com"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_viewer_cannot_create_contact(self):
        self.client.force_authenticate(user=self.viewer)
        response = self.client.post(
            f"/api/v1/contacts/companies/{self.company.id}/contacts/",
            {"type": "customer", "name": "Nope Customer"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_owner_can_delete_contact(self):
        self.client.force_authenticate(user=self.owner)
        contact = Contact.objects.create(company=self.company, type="customer", name="Temp Customer")
        response = self.client.delete(f"/api/v1/contacts/companies/{self.company.id}/contacts/{contact.id}/")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Contact.objects.filter(id=contact.id).exists())

    def test_viewer_cannot_delete_contact(self):
        self.client.force_authenticate(user=self.owner)
        contact = Contact.objects.create(company=self.company, type="customer", name="Protected Customer")
        self.client.force_authenticate(user=self.viewer)
        response = self.client.delete(f"/api/v1/contacts/companies/{self.company.id}/contacts/{contact.id}/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_cross_tenant_contact_access_denied(self):
        other_owner = User.objects.create_user(
            email="contact-other-owner@test.local",
            password="SecurePass@123",
            full_name="Contact Other Owner",
        )
        other_company = create_company_for_user(
            user=other_owner,
            company_data={
                "name": "Other Contact Co",
                "slug": "other-contact-co",
                "base_currency": "USD",
                "timezone": "UTC",
                "fiscal_year_start_month": 1,
                "is_active": True,
            },
        )
        contact = Contact.objects.create(company=self.company, type="customer", name="Tenant Locked")

        self.client.force_authenticate(user=other_owner)
        response = self.client.get(f"/api/v1/contacts/companies/{other_company.id}/contacts/{contact.id}/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
