import uuid

from django.core.cache import cache
from django.test import override_settings
from django.urls import path
from rest_framework import status
from rest_framework import permissions
from rest_framework import response
from rest_framework.test import APITestCase
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from apps.companies.models import Company, CompanyMember
from apps.users.models import User


class _ServerErrorView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        raise RuntimeError("boom")


class _ThrottledView(APIView):
    class _OnePerMinuteAnonThrottle(AnonRateThrottle):
        rate = "1/min"

    permission_classes = [permissions.AllowAny]
    throttle_classes = [_OnePerMinuteAnonThrottle]

    def get(self, request):
        return response.Response({"ok": True})


urlpatterns = [
    path("test/server-error/", _ServerErrorView.as_view()),
    path("test/throttled/", _ThrottledView.as_view()),
]


@override_settings(ALLOWED_HOSTS=["testserver", "localhost", "127.0.0.1"])
class ErrorSchemaTests(APITestCase):
    def test_validation_error_uses_standard_schema(self):
        user = User.objects.create_user(
            email="validation.user@example.com",
            full_name="Validation User",
            password="Pass1234!",
        )
        self.client.force_authenticate(user=user)

        response = self.client.post(
            "/api/v1/companies/members/invite/accept/",
            data={},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["error"]["code"], "bad_request")
        self.assertEqual(response.data["error"]["message"], "Validation failed.")
        self.assertIn("details", response.data["error"])
        self.assertIn("token", response.data["error"]["details"])

    def test_unauthenticated_error_uses_standard_schema(self):
        response = self.client.get("/api/v1/companies/")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn("error", response.data)
        self.assertEqual(response.data["error"]["code"], "unauthorized")
        self.assertIn("message", response.data["error"])
        self.assertIn("request_id", response.data["error"])
        self.assertIn("request_id", response.data)

    def test_legacy_detail_error_is_normalized_by_middleware(self):
        user = User.objects.create_user(
            email="member.no.role@example.com",
            full_name="Member Without Role",
            password="Pass1234!",
        )
        company = Company.objects.create(
            name="No Role Co",
            slug="no-role-co",
            base_currency="USD",
            timezone="UTC",
            fiscal_year_start_month=1,
        )
        CompanyMember.objects.create(company=company, user=user)

        self.client.force_authenticate(user=user)
        response = self.client.patch(
            f"/api/v1/companies/{company.id}/",
            data={"name": "Changed Name"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data["error"]["code"], "forbidden")
        self.assertEqual(response.data["error"]["message"], "Insufficient company permissions.")
        self.assertIn("request_id", response.data["error"])
        self.assertIn("request_id", response.data)

    def test_not_found_error_uses_standard_schema(self):
        user = User.objects.create_user(
            email="not.found.user@example.com",
            full_name="Not Found User",
            password="Pass1234!",
        )
        self.client.force_authenticate(user=user)

        response = self.client.get(f"/api/v1/companies/{uuid.uuid4()}/")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(response.data["error"]["code"], "not_found")
        self.assertIn("message", response.data["error"])

    def test_throttle_error_uses_standard_schema(self):
        with override_settings(ROOT_URLCONF="apps.common.tests"):
            cache.clear()
            self.client.get("/test/throttled/")
            response = self.client.get("/test/throttled/")

        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(response.data["error"]["code"], "rate_limited")
        self.assertIn("message", response.data["error"])

    @override_settings(ROOT_URLCONF="apps.common.tests")
    def test_internal_server_error_uses_standard_schema(self):
        self.client.raise_request_exception = False

        response = self.client.get("/test/server-error/")
        body = response.json()

        self.assertEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
        self.assertEqual(body["error"]["code"], "server_error")
        self.assertEqual(body["error"]["message"], "Internal server error.")
        self.assertNotIn("Traceback", response.content.decode())
        self.assertNotIn("RuntimeError", response.content.decode())

    def test_error_schema_for_unauthorized_major_module_endpoints(self):
        endpoints = [
            "/api/v1/companies/",
            "/api/v1/accounting/companies/00000000-0000-0000-0000-000000000001/accounts/",
            "/api/v1/journals/companies/00000000-0000-0000-0000-000000000001/journals/",
            "/api/v1/contacts/companies/00000000-0000-0000-0000-000000000001/contacts/",
            "/api/v1/sales/companies/00000000-0000-0000-0000-000000000001/invoices/",
            "/api/v1/purchases/companies/00000000-0000-0000-0000-000000000001/bills/",
            "/api/v1/banking/companies/00000000-0000-0000-0000-000000000001/bank-accounts/",
            "/api/v1/reports/companies/00000000-0000-0000-0000-000000000001/profit-loss/",
            "/api/v1/rbac/companies/00000000-0000-0000-0000-000000000001/me/",
        ]
        for endpoint in endpoints:
            response = self.client.get(endpoint)
            self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
            self.assertIn("error", response.data)
            self.assertEqual(response.data["error"]["code"], "unauthorized")
