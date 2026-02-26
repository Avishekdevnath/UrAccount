from unittest.mock import patch

from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.companies.models import Company, CompanyMember, CompanyMemberStatus
from apps.companies.services import create_company_for_user
from apps.rbac.constants import ROLE_ADMIN, ROLE_OWNER
from apps.rbac.models import CompanyRole, CompanyRoleAssignment
from apps.system_admin.models import SystemAuditLog, SystemCompanyConfig, SystemRole
from apps.system_admin.services import bootstrap_company_with_owner
from apps.system_admin.views import (
    SystemAuditLogListView,
    SystemCompanyBootstrapView,
    SystemCompanyDetailView,
    SystemCompanyFeatureFlagsView,
    SystemCompanyListView,
    SystemCompanyMemberRemoveView,
    SystemCompanyMemberRolesView,
    SystemCompanyMemberUpsertView,
    SystemCompanyQuotasView,
    SystemCompanyStatusView,
    SystemFeatureFlagsView,
    SystemHealthView,
    SystemUserDetailView,
    SystemUserListView,
    SystemUserRoleView,
    SystemUserResetPasswordView,
)
from apps.users.models import User
from apps.users.views import LoginView


class SystemAdminViewTests(TestCase):
    def setUp(self):
        self.system_user = User.objects.create_user(
            email="sysadmin@test.local",
            password="SecurePass@123",
            full_name="System Admin",
        )
        SystemRole.objects.create(
            user=self.system_user,
            role=SystemRole.ROLE_SUPER_ADMIN,
            is_active=True,
        )

        self.normal_user = User.objects.create_user(
            email="normal@test.local",
            password="SecurePass@123",
            full_name="Normal User",
        )
        self.support_user = User.objects.create_user(
            email="support@test.local",
            password="SecurePass@123",
            full_name="Support User",
        )
        SystemRole.objects.create(
            user=self.support_user,
            role=SystemRole.ROLE_SUPPORT,
            is_active=True,
        )

    @staticmethod
    def _run_request(view_cls, user, method, path, data=None, **kwargs):
        factory = APIRequestFactory()
        if method == "GET":
            request = factory.get(path)
        elif method == "POST":
            request = factory.post(path, data=data or {}, format="json")
        elif method == "PATCH":
            request = factory.patch(path, data=data or {}, format="json")
        elif method == "DELETE":
            request = factory.delete(path)
        else:
            raise ValueError(f"Unsupported method: {method}")
        force_authenticate(request, user=user)
        return view_cls.as_view()(request, **kwargs)

    def _run_get(self, view_cls, user, path, **kwargs):
        return self._run_request(view_cls, user, "GET", path, **kwargs)

    def _run_patch(self, view_cls, user, path, data, **kwargs):
        return self._run_request(view_cls, user, "PATCH", path, data=data, **kwargs)

    def _run_post(self, view_cls, user, path, data, **kwargs):
        return self._run_request(view_cls, user, "POST", path, data=data, **kwargs)

    def _run_delete(self, view_cls, user, path, **kwargs):
        return self._run_request(view_cls, user, "DELETE", path, **kwargs)

    @override_settings(SYSTEM_ADMIN_ENABLED=True)
    def test_super_admin_bootstrap_company_with_new_owner(self):
        payload = {
            "company": {
                "name": "Bootstrap Co",
                "slug": "bootstrap-co",
                "base_currency": "usd",
                "timezone": "UTC",
                "fiscal_year_start_month": 1,
            },
            "owner": {
                "email": "owner-bootstrap@test.local",
                "full_name": "Bootstrap Owner",
                "password": "SecurePass@123",
            },
        }

        response = self._run_post(
            SystemCompanyBootstrapView,
            self.system_user,
            "/api/v1/system/companies/bootstrap/",
            data=payload,
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["company_slug"], "bootstrap-co")
        self.assertTrue(response.data["owner_created"])

        company = Company.objects.get(slug="bootstrap-co")
        owner = User.objects.get(email="owner-bootstrap@test.local")
        self.assertTrue(owner.check_password("SecurePass@123"))
        self.assertTrue(CompanyMember.objects.filter(company=company, user=owner, status=CompanyMemberStatus.ACTIVE).exists())
        self.assertTrue(
            CompanyRoleAssignment.objects.filter(
                company=company,
                user=owner,
                role__name=ROLE_OWNER,
            ).exists()
        )
        self.assertTrue(SystemCompanyConfig.objects.filter(company=company).exists())
        self.assertTrue(SystemAuditLog.objects.filter(action="system.company.bootstrap", resource_id=str(company.id)).exists())

    @override_settings(SYSTEM_ADMIN_ENABLED=True)
    def test_bootstrap_company_with_existing_owner_links_user(self):
        existing_owner = User.objects.create_user(
            email="existing-owner@test.local",
            password="SecurePass@123",
            full_name="Existing Owner",
        )
        payload = {
            "company": {
                "name": "Bootstrap Existing Owner Co",
                "slug": "bootstrap-existing-owner-co",
                "base_currency": "USD",
                "timezone": "UTC",
                "fiscal_year_start_month": 1,
            },
            "owner": {
                "email": "existing-owner@test.local",
            },
        }

        response = self._run_post(
            SystemCompanyBootstrapView,
            self.system_user,
            "/api/v1/system/companies/bootstrap/",
            data=payload,
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertFalse(response.data["owner_created"])
        self.assertEqual(response.data["owner_user_id"], str(existing_owner.id))

    @override_settings(SYSTEM_ADMIN_ENABLED=True)
    def test_bootstrap_requires_password_for_new_owner(self):
        payload = {
            "company": {
                "name": "Bootstrap Missing Password Co",
                "slug": "bootstrap-missing-password-co",
                "base_currency": "USD",
                "timezone": "UTC",
                "fiscal_year_start_month": 1,
            },
            "owner": {
                "email": "new-owner-missing-password@test.local",
                "full_name": "Missing Password Owner",
            },
        }

        response = self._run_post(
            SystemCompanyBootstrapView,
            self.system_user,
            "/api/v1/system/companies/bootstrap/",
            data=payload,
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @override_settings(SYSTEM_ADMIN_ENABLED=True)
    def test_support_cannot_bootstrap_company(self):
        payload = {
            "company": {
                "name": "Support Blocked Bootstrap",
                "slug": "support-blocked-bootstrap",
                "base_currency": "USD",
                "timezone": "UTC",
                "fiscal_year_start_month": 1,
            },
            "owner": {
                "email": "owner-support-blocked@test.local",
                "full_name": "Owner Support Blocked",
                "password": "SecurePass@123",
            },
        }

        response = self._run_post(
            SystemCompanyBootstrapView,
            self.support_user,
            "/api/v1/system/companies/bootstrap/",
            data=payload,
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    @override_settings(SYSTEM_ADMIN_ENABLED=True)
    def test_super_admin_can_create_user_account(self):
        payload = {
            "email": "created-by-system@test.local",
            "full_name": "Created By System",
            "password": "SecurePass@123",
            "is_active": True,
            "is_staff": False,
        }
        response = self._run_post(
            SystemUserListView,
            self.system_user,
            "/api/v1/system/users/",
            data=payload,
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created = User.objects.get(email="created-by-system@test.local")
        self.assertEqual(created.full_name, "Created By System")
        self.assertTrue(created.check_password("SecurePass@123"))
        self.assertTrue(SystemAuditLog.objects.filter(action="system.user.create", resource_id=str(created.id)).exists())

    @override_settings(SYSTEM_ADMIN_ENABLED=True)
    def test_support_cannot_create_user_account(self):
        payload = {
            "email": "blocked-create@test.local",
            "full_name": "Blocked Create",
            "password": "SecurePass@123",
        }
        response = self._run_post(
            SystemUserListView,
            self.support_user,
            "/api/v1/system/users/",
            data=payload,
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    @override_settings(SYSTEM_ADMIN_ENABLED=True)
    def test_super_admin_can_update_user_account(self):
        target = User.objects.create_user(
            email="update-target@test.local",
            password="SecurePass@123",
            full_name="Old Name",
        )
        response = self._run_patch(
            SystemUserDetailView,
            self.system_user,
            f"/api/v1/system/users/{target.id}/",
            data={"full_name": "New Name", "is_active": False},
            user_id=str(target.id),
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        target.refresh_from_db()
        self.assertEqual(target.full_name, "New Name")
        self.assertFalse(target.is_active)
        self.assertTrue(SystemAuditLog.objects.filter(action="system.user.update", resource_id=str(target.id)).exists())

    @override_settings(SYSTEM_ADMIN_ENABLED=True)
    def test_super_admin_can_reset_user_password(self):
        target = User.objects.create_user(
            email="reset-target@test.local",
            password="OldPass@123",
            full_name="Reset Target",
        )
        response = self._run_post(
            SystemUserResetPasswordView,
            self.system_user,
            f"/api/v1/system/users/{target.id}/reset-password/",
            data={"new_password": "NewPass@12345"},
            user_id=str(target.id),
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        target.refresh_from_db()
        self.assertTrue(target.check_password("NewPass@12345"))
        self.assertTrue(SystemAuditLog.objects.filter(action="system.user.reset_password", resource_id=str(target.id)).exists())

    @override_settings(SYSTEM_ADMIN_ENABLED=True)
    def test_super_admin_can_deactivate_user_account(self):
        target = User.objects.create_user(
            email="deactivate-target@test.local",
            password="SecurePass@123",
            full_name="Deactivate Target",
        )
        SystemRole.objects.create(user=target, role=SystemRole.ROLE_SUPPORT, is_active=True)

        response = self._run_delete(
            SystemUserDetailView,
            self.system_user,
            f"/api/v1/system/users/{target.id}/",
            user_id=str(target.id),
        )
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        target.refresh_from_db()
        self.assertFalse(target.is_active)
        self.assertFalse(SystemRole.objects.get(user=target).is_active)
        self.assertTrue(SystemAuditLog.objects.filter(action="system.user.deactivate", resource_id=str(target.id)).exists())

    @override_settings(SYSTEM_ADMIN_ENABLED=True)
    def test_super_admin_can_upsert_company_member_with_roles(self):
        owner = User.objects.create_user(
            email="member-owner@test.local",
            password="SecurePass@123",
            full_name="Member Owner",
        )
        user = User.objects.create_user(
            email="member-user@test.local",
            password="SecurePass@123",
            full_name="Member User",
        )
        company = create_company_for_user(
            user=owner,
            company_data={
                "name": "Membership Upsert Co",
                "slug": "membership-upsert-co",
                "base_currency": "USD",
                "timezone": "UTC",
                "fiscal_year_start_month": 1,
                "is_active": True,
            },
        )

        response = self._run_post(
            SystemCompanyMemberUpsertView,
            self.system_user,
            f"/api/v1/system/companies/{company.id}/members/",
            data={
                "user_id": str(user.id),
                "status": CompanyMemberStatus.ACTIVE,
                "roles": [ROLE_ADMIN],
            },
            company_id=str(company.id),
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        member = CompanyMember.objects.get(company=company, user=user)
        self.assertEqual(member.status, CompanyMemberStatus.ACTIVE)
        self.assertTrue(
            CompanyRoleAssignment.objects.filter(company=company, user=user, role__name=ROLE_ADMIN).exists()
        )

    @override_settings(SYSTEM_ADMIN_ENABLED=True)
    def test_super_admin_can_replace_member_roles(self):
        owner = User.objects.create_user(
            email="role-owner@test.local",
            password="SecurePass@123",
            full_name="Role Owner",
        )
        user = User.objects.create_user(
            email="role-user@test.local",
            password="SecurePass@123",
            full_name="Role User",
        )
        company = create_company_for_user(
            user=owner,
            company_data={
                "name": "Membership Roles Co",
                "slug": "membership-roles-co",
                "base_currency": "USD",
                "timezone": "UTC",
                "fiscal_year_start_month": 1,
                "is_active": True,
            },
        )
        member = CompanyMember.objects.create(company=company, user=user, status=CompanyMemberStatus.ACTIVE)
        owner_role = CompanyRole.objects.get(company=company, name=ROLE_OWNER)
        CompanyRoleAssignment.objects.create(company=company, user=user, role=owner_role)

        response = self._run_patch(
            SystemCompanyMemberRolesView,
            self.system_user,
            f"/api/v1/system/companies/{company.id}/members/{user.id}/roles/",
            data={"roles": [ROLE_ADMIN]},
            company_id=str(company.id),
            user_id=str(user.id),
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        roles = sorted(
            CompanyRoleAssignment.objects.filter(company=company, user=user).values_list("role__name", flat=True)
        )
        self.assertEqual(roles, [ROLE_ADMIN])

    @override_settings(SYSTEM_ADMIN_ENABLED=True)
    def test_super_admin_can_remove_company_member(self):
        owner = User.objects.create_user(
            email="remove-owner@test.local",
            password="SecurePass@123",
            full_name="Remove Owner",
        )
        user = User.objects.create_user(
            email="remove-user@test.local",
            password="SecurePass@123",
            full_name="Remove User",
        )
        company = create_company_for_user(
            user=owner,
            company_data={
                "name": "Remove Member Co",
                "slug": "remove-member-co",
                "base_currency": "USD",
                "timezone": "UTC",
                "fiscal_year_start_month": 1,
                "is_active": True,
            },
        )
        CompanyMember.objects.create(company=company, user=user, status=CompanyMemberStatus.ACTIVE)
        owner_role = CompanyRole.objects.get(company=company, name=ROLE_OWNER)
        CompanyRoleAssignment.objects.create(company=company, user=user, role=owner_role)

        response = self._run_delete(
            SystemCompanyMemberRemoveView,
            self.system_user,
            f"/api/v1/system/companies/{company.id}/members/{user.id}/",
            company_id=str(company.id),
            user_id=str(user.id),
        )
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        member = CompanyMember.objects.get(company=company, user=user)
        self.assertEqual(member.status, CompanyMemberStatus.DISABLED)
        self.assertFalse(CompanyRoleAssignment.objects.filter(company=company, user=user).exists())

    @override_settings(SYSTEM_ADMIN_ENABLED=True)
    def test_health_view_allows_system_admin_when_enabled(self):
        response = self._run_get(SystemHealthView, self.system_user, "/api/v1/system/health/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "ok")

    @override_settings(SYSTEM_ADMIN_ENABLED=False)
    def test_health_view_blocks_system_admin_when_disabled(self):
        response = self._run_get(SystemHealthView, self.system_user, "/api/v1/system/health/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    @override_settings(SYSTEM_ADMIN_ENABLED=True)
    def test_health_view_blocks_non_system_user(self):
        response = self._run_get(SystemHealthView, self.normal_user, "/api/v1/system/health/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    @override_settings(SYSTEM_ADMIN_ENABLED=True)
    def test_companies_list_returns_member_counts(self):
        owner = User.objects.create_user(
            email="owner@test.local",
            password="SecurePass@123",
            full_name="Owner One",
        )
        extra_member = User.objects.create_user(
            email="member@test.local",
            password="SecurePass@123",
            full_name="Member One",
        )

        company = create_company_for_user(
            user=owner,
            company_data={
                "name": "System Admin Co",
                "slug": "system-admin-co",
                "base_currency": "USD",
                "timezone": "UTC",
                "fiscal_year_start_month": 1,
                "is_active": True,
            },
        )
        CompanyMember.objects.create(company=company, user=extra_member, status=CompanyMemberStatus.ACTIVE)

        response = self._run_get(SystemCompanyListView, self.system_user, "/api/v1/system/companies/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(response.data["count"], 1)
        company_entry = next(item for item in response.data["results"] if item["slug"] == "system-admin-co")
        self.assertEqual(company_entry["members_count"], 2)

    @override_settings(
        SYSTEM_ADMIN_ENABLED=True,
        AI_ENABLED=True,
        SUBSCRIPTION_ENABLED=False,
        ENABLE_BROWSABLE_API=True,
    )
    def test_feature_flags_view_returns_runtime_settings(self):
        response = self._run_get(
            SystemFeatureFlagsView,
            self.system_user,
            "/api/v1/system/feature-flags/",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data,
            {
                "system_admin_enabled": True,
                "ai_enabled": True,
                "subscription_enabled": False,
                "browsable_api_enabled": True,
            },
        )

    @override_settings(SYSTEM_ADMIN_ENABLED=True)
    def test_company_detail_returns_default_flags_and_quotas_without_config_row(self):
        owner = User.objects.create_user(
            email="owner2@test.local",
            password="SecurePass@123",
            full_name="Owner Two",
        )
        company = create_company_for_user(
            user=owner,
            company_data={
                "name": "No Config Co",
                "slug": "no-config-co",
                "base_currency": "USD",
                "timezone": "UTC",
                "fiscal_year_start_month": 1,
                "is_active": True,
            },
        )

        response = self._run_get(
            SystemCompanyDetailView,
            self.system_user,
            f"/api/v1/system/companies/{company.id}/",
            company_id=str(company.id),
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["slug"], "no-config-co")
        self.assertEqual(
            response.data["feature_flags"],
            {
                "ai_enabled": False,
                "ai_suggestions_enabled": False,
                "ai_rag_enabled": False,
                "extra_flags": {},
            },
        )
        self.assertEqual(
            response.data["quotas"],
            {
                "max_users": None,
                "max_storage_mb": None,
                "max_api_requests_per_minute": None,
            },
        )

    @override_settings(SYSTEM_ADMIN_ENABLED=True)
    def test_company_feature_flags_view_uses_company_config(self):
        owner = User.objects.create_user(
            email="owner3@test.local",
            password="SecurePass@123",
            full_name="Owner Three",
        )
        company = create_company_for_user(
            user=owner,
            company_data={
                "name": "Config Co",
                "slug": "config-co",
                "base_currency": "USD",
                "timezone": "UTC",
                "fiscal_year_start_month": 1,
                "is_active": True,
            },
        )
        SystemCompanyConfig.objects.create(
            company=company,
            ai_enabled=True,
            ai_suggestions_enabled=True,
            ai_rag_enabled=False,
            extra_flags={"beta_feature_x": True},
        )

        response = self._run_get(
            SystemCompanyFeatureFlagsView,
            self.system_user,
            f"/api/v1/system/companies/{company.id}/feature-flags/",
            company_id=str(company.id),
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["company_slug"], "config-co")
        self.assertEqual(
            response.data["feature_flags"],
            {
                "ai_enabled": True,
                "ai_suggestions_enabled": True,
                "ai_rag_enabled": False,
                "extra_flags": {"beta_feature_x": True},
            },
        )

    @override_settings(SYSTEM_ADMIN_ENABLED=True)
    def test_user_detail_includes_memberships(self):
        owner = User.objects.create_user(
            email="owner4@test.local",
            password="SecurePass@123",
            full_name="Owner Four",
        )
        user = User.objects.create_user(
            email="member4@test.local",
            password="SecurePass@123",
            full_name="Member Four",
        )
        company = create_company_for_user(
            user=owner,
            company_data={
                "name": "Membership Co",
                "slug": "membership-co",
                "base_currency": "USD",
                "timezone": "UTC",
                "fiscal_year_start_month": 1,
                "is_active": True,
            },
        )
        CompanyMember.objects.create(company=company, user=user, status=CompanyMemberStatus.ACTIVE)

        response = self._run_get(
            SystemUserDetailView,
            self.system_user,
            f"/api/v1/system/users/{user.id}/",
            user_id=str(user.id),
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["email"], "member4@test.local")
        self.assertEqual(len(response.data["memberships"]), 1)
        self.assertEqual(response.data["memberships"][0]["company_slug"], "membership-co")

    @override_settings(SYSTEM_ADMIN_ENABLED=True)
    def test_support_cannot_patch_feature_flags(self):
        owner = User.objects.create_user(
            email="owner5@test.local",
            password="SecurePass@123",
            full_name="Owner Five",
        )
        company = create_company_for_user(
            user=owner,
            company_data={
                "name": "Support Forbidden Co",
                "slug": "support-forbidden-co",
                "base_currency": "USD",
                "timezone": "UTC",
                "fiscal_year_start_month": 1,
                "is_active": True,
            },
        )

        response = self._run_patch(
            SystemCompanyFeatureFlagsView,
            self.support_user,
            f"/api/v1/system/companies/{company.id}/feature-flags/",
            data={"ai_enabled": True},
            company_id=str(company.id),
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    @override_settings(SYSTEM_ADMIN_ENABLED=True)
    def test_super_admin_patch_feature_flags_updates_and_audits(self):
        owner = User.objects.create_user(
            email="owner6@test.local",
            password="SecurePass@123",
            full_name="Owner Six",
        )
        company = create_company_for_user(
            user=owner,
            company_data={
                "name": "Patch Flags Co",
                "slug": "patch-flags-co",
                "base_currency": "USD",
                "timezone": "UTC",
                "fiscal_year_start_month": 1,
                "is_active": True,
            },
        )

        response = self._run_patch(
            SystemCompanyFeatureFlagsView,
            self.system_user,
            f"/api/v1/system/companies/{company.id}/feature-flags/",
            data={
                "ai_enabled": True,
                "ai_suggestions_enabled": True,
                "ai_rag_enabled": False,
                "extra_flags": {"assistant_ui_enabled": True},
            },
            company_id=str(company.id),
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["feature_flags"]["ai_enabled"], True)
        self.assertEqual(response.data["feature_flags"]["ai_suggestions_enabled"], True)
        self.assertEqual(response.data["feature_flags"]["extra_flags"]["assistant_ui_enabled"], True)

        config = SystemCompanyConfig.objects.get(company=company)
        self.assertTrue(config.ai_enabled)
        self.assertTrue(config.ai_suggestions_enabled)
        self.assertFalse(config.ai_rag_enabled)

        audit = SystemAuditLog.objects.filter(action="system.company.feature_flags.update").latest("created_at")
        self.assertEqual(audit.resource_type, "system_company_config")
        self.assertEqual(audit.metadata["company_slug"], "patch-flags-co")

    @override_settings(SYSTEM_ADMIN_ENABLED=True)
    def test_super_admin_patch_quotas_updates_and_audits(self):
        owner = User.objects.create_user(
            email="owner7@test.local",
            password="SecurePass@123",
            full_name="Owner Seven",
        )
        company = create_company_for_user(
            user=owner,
            company_data={
                "name": "Patch Quotas Co",
                "slug": "patch-quotas-co",
                "base_currency": "USD",
                "timezone": "UTC",
                "fiscal_year_start_month": 1,
                "is_active": True,
            },
        )

        response = self._run_patch(
            SystemCompanyQuotasView,
            self.system_user,
            f"/api/v1/system/companies/{company.id}/quotas/",
            data={"max_users": 25, "max_storage_mb": 2048, "max_api_requests_per_minute": 400},
            company_id=str(company.id),
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["quotas"]["max_users"], 25)
        self.assertEqual(response.data["quotas"]["max_storage_mb"], 2048)
        self.assertEqual(response.data["quotas"]["max_api_requests_per_minute"], 400)

        config = SystemCompanyConfig.objects.get(company=company)
        self.assertEqual(config.max_users, 25)
        self.assertEqual(config.max_storage_mb, 2048)
        self.assertEqual(config.max_api_requests_per_minute, 400)

        audit = SystemAuditLog.objects.filter(action="system.company.quotas.update").latest("created_at")
        self.assertEqual(audit.resource_type, "system_company_config")
        self.assertEqual(audit.metadata["company_slug"], "patch-quotas-co")

    # ── M1: Company Status ────────────────────────────────────────────────────

    @override_settings(SYSTEM_ADMIN_ENABLED=True)
    def test_company_status_deactivate(self):
        owner = User.objects.create_user(
            email="statusowner@test.local",
            password="SecurePass@123",
            full_name="Status Owner",
        )
        company = create_company_for_user(
            user=owner,
            company_data={
                "name": "Status Co",
                "slug": "status-co",
                "base_currency": "USD",
                "timezone": "UTC",
                "fiscal_year_start_month": 1,
                "is_active": True,
            },
        )
        self.assertTrue(company.is_active)

        factory = APIRequestFactory()
        request = factory.patch(
            f"/api/v1/system/companies/{company.id}/status/",
            data={"is_active": False},
            format="json",
        )
        force_authenticate(request, user=self.system_user)
        response = SystemCompanyStatusView.as_view()(request, company_id=str(company.id))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["is_active"])

        company.refresh_from_db()
        self.assertFalse(company.is_active)

        audit = SystemAuditLog.objects.filter(action="system.company.status.update").latest("created_at")
        self.assertEqual(audit.resource_type, "company")
        self.assertEqual(audit.before["is_active"], True)
        self.assertEqual(audit.after["is_active"], False)

    @override_settings(SYSTEM_ADMIN_ENABLED=True)
    def test_company_status_blocked_for_support_role(self):
        owner = User.objects.create_user(
            email="statusowner2@test.local",
            password="SecurePass@123",
            full_name="Status Owner 2",
        )
        company = create_company_for_user(
            user=owner,
            company_data={
                "name": "Status Co 2",
                "slug": "status-co-2",
                "base_currency": "USD",
                "timezone": "UTC",
                "fiscal_year_start_month": 1,
                "is_active": True,
            },
        )

        factory = APIRequestFactory()
        request = factory.patch(
            f"/api/v1/system/companies/{company.id}/status/",
            data={"is_active": False},
            format="json",
        )
        force_authenticate(request, user=self.support_user)
        response = SystemCompanyStatusView.as_view()(request, company_id=str(company.id))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # ── M1: User Role Management ──────────────────────────────────────────────

    @override_settings(SYSTEM_ADMIN_ENABLED=True)
    def test_grant_system_role_creates_new_role(self):
        target = User.objects.create_user(
            email="target@test.local",
            password="SecurePass@123",
            full_name="Target User",
        )
        self.assertFalse(SystemRole.objects.filter(user=target).exists())

        factory = APIRequestFactory()
        request = factory.patch(
            f"/api/v1/system/users/{target.id}/system-role/",
            data={"role": "SUPPORT", "is_active": True},
            format="json",
        )
        force_authenticate(request, user=self.system_user)
        response = SystemUserRoleView.as_view()(request, user_id=str(target.id))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["system_role"]["role"], "SUPPORT")

        role = SystemRole.objects.get(user=target)
        self.assertEqual(role.role, SystemRole.ROLE_SUPPORT)
        self.assertTrue(role.is_active)

        audit = SystemAuditLog.objects.filter(action="system.user.system_role.update").latest("created_at")
        self.assertIsNone(audit.before)
        self.assertEqual(audit.after["role"], "SUPPORT")

    @override_settings(SYSTEM_ADMIN_ENABLED=True)
    def test_revoke_system_role_deletes_role(self):
        target = User.objects.create_user(
            email="revoketarget@test.local",
            password="SecurePass@123",
            full_name="Revoke Target",
        )
        SystemRole.objects.create(user=target, role=SystemRole.ROLE_SUPPORT, is_active=True)

        factory = APIRequestFactory()
        request = factory.patch(
            f"/api/v1/system/users/{target.id}/system-role/",
            data={"role": None},
            format="json",
        )
        force_authenticate(request, user=self.system_user)
        response = SystemUserRoleView.as_view()(request, user_id=str(target.id))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.data["system_role"])
        self.assertFalse(SystemRole.objects.filter(user=target).exists())

    @override_settings(SYSTEM_ADMIN_ENABLED=True)
    def test_user_role_blocked_for_support_role(self):
        target = User.objects.create_user(
            email="urtarget@test.local",
            password="SecurePass@123",
            full_name="UR Target",
        )

        factory = APIRequestFactory()
        request = factory.patch(
            f"/api/v1/system/users/{target.id}/system-role/",
            data={"role": "SUPPORT"},
            format="json",
        )
        force_authenticate(request, user=self.support_user)
        response = SystemUserRoleView.as_view()(request, user_id=str(target.id))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # ── M1: Audit Log List ────────────────────────────────────────────────────

    @override_settings(SYSTEM_ADMIN_ENABLED=True)
    def test_audit_log_list_returns_entries(self):
        SystemAuditLog.objects.create(
            actor=self.system_user,
            action="system.test.action",
            resource_type="test_resource",
            resource_id="abc123",
        )

        factory = APIRequestFactory()
        request = factory.get("/api/v1/system/audit-logs/")
        force_authenticate(request, user=self.system_user)
        response = SystemAuditLogListView.as_view()(request)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(response.data["count"], 1)
        entries = response.data["results"]
        actions = [e["action"] for e in entries]
        self.assertIn("system.test.action", actions)

    @override_settings(SYSTEM_ADMIN_ENABLED=True)
    def test_audit_log_list_filter_by_action(self):
        SystemAuditLog.objects.create(
            actor=self.system_user,
            action="system.unique.filter.action",
            resource_type="test_resource",
            resource_id="xyz",
        )

        factory = APIRequestFactory()
        request = factory.get(
            "/api/v1/system/audit-logs/",
            {"action": "unique.filter"},
        )
        force_authenticate(request, user=self.system_user)
        response = SystemAuditLogListView.as_view()(request)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        for entry in response.data["results"]:
            self.assertIn("unique.filter", entry["action"])

    @override_settings(SYSTEM_ADMIN_ENABLED=True)
    def test_audit_log_accessible_to_support_role(self):
        factory = APIRequestFactory()
        request = factory.get("/api/v1/system/audit-logs/")
        force_authenticate(request, user=self.support_user)
        response = SystemAuditLogListView.as_view()(request)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    @override_settings(SYSTEM_ADMIN_ENABLED=True)
    def test_audit_log_blocked_for_non_system_user(self):
        factory = APIRequestFactory()
        request = factory.get("/api/v1/system/audit-logs/")
        force_authenticate(request, user=self.normal_user)
        response = SystemAuditLogListView.as_view()(request)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # ── Last-SUPER_ADMIN guard ────────────────────────────────────────────────

    @override_settings(SYSTEM_ADMIN_ENABLED=True)
    def test_cannot_revoke_last_super_admin_role(self):
        """Revoking the only active SUPER_ADMIN role must return 400."""
        factory = APIRequestFactory()
        request = factory.patch(
            f"/api/v1/system/users/{self.system_user.id}/system-role/",
            data={"role": None},
            format="json",
        )
        force_authenticate(request, user=self.system_user)
        response = SystemUserRoleView.as_view()(request, user_id=str(self.system_user.id))

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        # Role must still exist
        self.assertTrue(SystemRole.objects.filter(user=self.system_user, is_active=True).exists())

    @override_settings(SYSTEM_ADMIN_ENABLED=True)
    def test_cannot_deactivate_last_super_admin(self):
        """Deactivating the only active SUPER_ADMIN user must return 400."""
        factory = APIRequestFactory()
        request = factory.delete(
            f"/api/v1/system/users/{self.system_user.id}/",
        )
        force_authenticate(request, user=self.system_user)
        response = SystemUserDetailView.as_view()(request, user_id=str(self.system_user.id))

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        # User must still be active
        self.system_user.refresh_from_db()
        self.assertTrue(self.system_user.is_active)

    @override_settings(SYSTEM_ADMIN_ENABLED=True)
    def test_bootstrap_transaction_rolls_back_when_company_creation_fails(self):
        owner_email = "rollback-owner@test.local"
        with patch("apps.system_admin.services.create_company_for_user", side_effect=RuntimeError("forced failure")):
            with self.assertRaises(RuntimeError):
                bootstrap_company_with_owner(
                    company_data={
                        "name": "Rollback Co",
                        "slug": "rollback-co",
                        "base_currency": "USD",
                        "timezone": "UTC",
                        "fiscal_year_start_month": 1,
                        "is_active": True,
                    },
                    owner_data={
                        "email": owner_email,
                        "full_name": "Rollback Owner",
                        "password": "SecurePass@123",
                    },
                )

        self.assertFalse(User.objects.filter(email=owner_email).exists())
        self.assertFalse(Company.objects.filter(slug="rollback-co").exists())

    @override_settings(SYSTEM_ADMIN_ENABLED=True)
    def test_bootstrap_owner_can_authenticate_after_creation(self):
        owner_email = "owner-auth@test.local"
        payload = {
            "company": {
                "name": "Auth Bootstrap Co",
                "slug": "auth-bootstrap-co",
                "base_currency": "USD",
                "timezone": "UTC",
                "fiscal_year_start_month": 1,
            },
            "owner": {
                "email": owner_email,
                "full_name": "Owner Auth",
                "password": "SecurePass@123",
            },
        }
        response = self._run_post(
            SystemCompanyBootstrapView,
            self.system_user,
            "/api/v1/system/companies/bootstrap/",
            data=payload,
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        login_request = APIRequestFactory().post(
            "/api/v1/auth/login/",
            data={"email": owner_email, "password": "SecurePass@123"},
            format="json",
        )
        login_response = LoginView.as_view()(login_request)
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)
        self.assertIn("access", login_response.data)
        self.assertIn("refresh", login_response.data)

    @override_settings(SYSTEM_ADMIN_ENABLED=True)
    def test_permission_matrix_for_system_read_endpoints(self):
        target_user = User.objects.create_user(
            email="matrix-user@test.local",
            password="SecurePass@123",
            full_name="Matrix User",
        )
        owner = User.objects.create_user(
            email="matrix-owner@test.local",
            password="SecurePass@123",
            full_name="Matrix Owner",
        )
        company = create_company_for_user(
            user=owner,
            company_data={
                "name": "Matrix Co",
                "slug": "matrix-co",
                "base_currency": "USD",
                "timezone": "UTC",
                "fiscal_year_start_month": 1,
                "is_active": True,
            },
        )

        cases = [
            (SystemHealthView, "/api/v1/system/health/", {}),
            (SystemFeatureFlagsView, "/api/v1/system/feature-flags/", {}),
            (SystemCompanyListView, "/api/v1/system/companies/", {}),
            (SystemCompanyDetailView, f"/api/v1/system/companies/{company.id}/", {"company_id": str(company.id)}),
            (
                SystemCompanyFeatureFlagsView,
                f"/api/v1/system/companies/{company.id}/feature-flags/",
                {"company_id": str(company.id)},
            ),
            (
                SystemCompanyQuotasView,
                f"/api/v1/system/companies/{company.id}/quotas/",
                {"company_id": str(company.id)},
            ),
            (SystemUserListView, "/api/v1/system/users/", {}),
            (SystemUserDetailView, f"/api/v1/system/users/{target_user.id}/", {"user_id": str(target_user.id)}),
            (SystemAuditLogListView, "/api/v1/system/audit-logs/", {}),
        ]

        for view, path, kwargs in cases:
            support_response = self._run_get(view, self.support_user, path, **kwargs)
            normal_response = self._run_get(view, self.normal_user, path, **kwargs)
            self.assertEqual(
                support_response.status_code,
                status.HTTP_200_OK,
                msg=f"Support should be allowed for GET {path}",
            )
            self.assertEqual(
                normal_response.status_code,
                status.HTTP_403_FORBIDDEN,
                msg=f"Normal user should be denied for GET {path}",
            )

    @override_settings(SYSTEM_ADMIN_ENABLED=True)
    def test_payload_validation_for_system_mutations(self):
        target = User.objects.create_user(
            email="payload-target@test.local",
            password="SecurePass@123",
            full_name="Payload Target",
        )
        owner = User.objects.create_user(
            email="payload-owner@test.local",
            password="SecurePass@123",
            full_name="Payload Owner",
        )
        company = create_company_for_user(
            user=owner,
            company_data={
                "name": "Payload Co",
                "slug": "payload-co",
                "base_currency": "USD",
                "timezone": "UTC",
                "fiscal_year_start_month": 1,
                "is_active": True,
            },
        )
        CompanyMember.objects.create(company=company, user=target, status=CompanyMemberStatus.ACTIVE)

        missing_password = self._run_post(
            SystemUserListView,
            self.system_user,
            "/api/v1/system/users/",
            data={"email": "x@test.local", "full_name": "No Password"},
        )
        self.assertEqual(missing_password.status_code, status.HTTP_400_BAD_REQUEST)

        invalid_company_roles = self._run_patch(
            SystemCompanyMemberRolesView,
            self.system_user,
            f"/api/v1/system/companies/{company.id}/members/{target.id}/roles/",
            data={"roles": ["NOT_A_VALID_ROLE"]},
            company_id=str(company.id),
            user_id=str(target.id),
        )
        self.assertEqual(invalid_company_roles.status_code, status.HTTP_400_BAD_REQUEST)

        invalid_quotas = self._run_patch(
            SystemCompanyQuotasView,
            self.system_user,
            f"/api/v1/system/companies/{company.id}/quotas/",
            data={"max_users": -1},
            company_id=str(company.id),
        )
        self.assertEqual(invalid_quotas.status_code, status.HTTP_400_BAD_REQUEST)

    @override_settings(SYSTEM_ADMIN_ENABLED=True)
    def test_company_member_mutations_write_system_audit(self):
        owner = User.objects.create_user(
            email="audit-owner@test.local",
            password="SecurePass@123",
            full_name="Audit Owner",
        )
        user = User.objects.create_user(
            email="audit-user@test.local",
            password="SecurePass@123",
            full_name="Audit User",
        )
        company = create_company_for_user(
            user=owner,
            company_data={
                "name": "Audit Membership Co",
                "slug": "audit-membership-co",
                "base_currency": "USD",
                "timezone": "UTC",
                "fiscal_year_start_month": 1,
                "is_active": True,
            },
        )

        upsert = self._run_post(
            SystemCompanyMemberUpsertView,
            self.system_user,
            f"/api/v1/system/companies/{company.id}/members/",
            data={
                "user_id": str(user.id),
                "status": CompanyMemberStatus.ACTIVE,
                "roles": [ROLE_ADMIN],
            },
            company_id=str(company.id),
        )
        self.assertEqual(upsert.status_code, status.HTTP_201_CREATED)
        member = CompanyMember.objects.get(company=company, user=user)
        self.assertTrue(
            SystemAuditLog.objects.filter(
                action="system.company.member.upsert",
                resource_id=str(member.id),
            ).exists()
        )

        replace_roles = self._run_patch(
            SystemCompanyMemberRolesView,
            self.system_user,
            f"/api/v1/system/companies/{company.id}/members/{user.id}/roles/",
            data={"roles": [ROLE_ADMIN]},
            company_id=str(company.id),
            user_id=str(user.id),
        )
        self.assertEqual(replace_roles.status_code, status.HTTP_200_OK)
        self.assertTrue(
            SystemAuditLog.objects.filter(
                action="system.company.member.roles.replace",
                resource_id=str(member.id),
            ).exists()
        )

        remove = self._run_delete(
            SystemCompanyMemberRemoveView,
            self.system_user,
            f"/api/v1/system/companies/{company.id}/members/{user.id}/",
            company_id=str(company.id),
            user_id=str(user.id),
        )
        self.assertEqual(remove.status_code, status.HTTP_204_NO_CONTENT)
        self.assertTrue(
            SystemAuditLog.objects.filter(
                action="system.company.member.remove",
                resource_id=str(member.id),
            ).exists()
        )

    @override_settings(SYSTEM_ADMIN_ENABLED=True)
    def test_audit_logs_support_pagination_and_date_filter(self):
        for idx in range(3):
            SystemAuditLog.objects.create(
                actor=self.system_user,
                action=f"system.pagination.test.{idx}",
                resource_type="test_resource",
                resource_id=str(idx),
            )

        page_1 = APIRequestFactory().get("/api/v1/system/audit-logs/", {"page_size": 1, "page": 1})
        force_authenticate(page_1, user=self.system_user)
        response_page_1 = SystemAuditLogListView.as_view()(page_1)
        self.assertEqual(response_page_1.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response_page_1.data["results"]), 1)

        page_2 = APIRequestFactory().get("/api/v1/system/audit-logs/", {"page_size": 1, "page": 2})
        force_authenticate(page_2, user=self.system_user)
        response_page_2 = SystemAuditLogListView.as_view()(page_2)
        self.assertEqual(response_page_2.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response_page_2.data["results"]), 1)
        self.assertNotEqual(response_page_1.data["results"][0]["id"], response_page_2.data["results"][0]["id"])

        date_from = APIRequestFactory().get("/api/v1/system/audit-logs/", {"date_from": "2100-01-01"})
        force_authenticate(date_from, user=self.system_user)
        date_response = SystemAuditLogListView.as_view()(date_from)
        self.assertEqual(date_response.status_code, status.HTTP_200_OK)
        self.assertEqual(date_response.data["count"], 0)

    @override_settings(SYSTEM_ADMIN_ENABLED=True)
    def test_denied_system_access_writes_audit_event(self):
        denied = self._run_get(SystemHealthView, self.normal_user, "/api/v1/system/health/")
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(SystemAuditLog.objects.filter(action="system.access.denied").exists())
