from rest_framework import generics, permissions, response, status, views

from apps.accounting.models import Account
from apps.accounting.serializers import AccountSerializer, AccountTreeSerializer
from apps.common.tenant import get_company_for_user_or_404, user_has_permission_in_company
from apps.rbac.constants import PERMISSION_ACCOUNTING_POST, PERMISSION_ACCOUNTING_VIEW


class AccountListCreateView(generics.ListCreateAPIView):
    serializer_class = AccountSerializer
    permission_classes = [permissions.IsAuthenticated]

    def _company(self):
        return get_company_for_user_or_404(user=self.request.user, company_id=self.kwargs["company_id"])

    def get_queryset(self):
        company = self._company()
        if not user_has_permission_in_company(
            user=self.request.user,
            company=company,
            permission_code=PERMISSION_ACCOUNTING_VIEW,
        ):
            return Account.objects.none()
        return Account.objects.filter(company=company).select_related("parent")

    def list(self, request, *args, **kwargs):
        company = self._company()
        if not user_has_permission_in_company(
            user=request.user,
            company=company,
            permission_code=PERMISSION_ACCOUNTING_VIEW,
        ):
            return response.Response({"detail": "Insufficient accounting view permission."}, status=status.HTTP_403_FORBIDDEN)
        return super().list(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        company = self._company()
        if not user_has_permission_in_company(
            user=request.user,
            company=company,
            permission_code=PERMISSION_ACCOUNTING_POST,
        ):
            return response.Response({"detail": "Insufficient accounting post permission."}, status=status.HTTP_403_FORBIDDEN)

        serializer = self.get_serializer(data=request.data, context={"company": company})
        serializer.is_valid(raise_exception=True)
        serializer.save(company=company)
        return response.Response(serializer.data, status=status.HTTP_201_CREATED)


class AccountDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = AccountSerializer
    permission_classes = [permissions.IsAuthenticated]

    def _company(self):
        return get_company_for_user_or_404(user=self.request.user, company_id=self.kwargs["company_id"])

    def get_object(self):
        company = self._company()
        return generics.get_object_or_404(Account, company=company, id=self.kwargs["account_id"])

    def retrieve(self, request, *args, **kwargs):
        company = self._company()
        if not user_has_permission_in_company(
            user=request.user,
            company=company,
            permission_code=PERMISSION_ACCOUNTING_VIEW,
        ):
            return response.Response({"detail": "Insufficient accounting view permission."}, status=status.HTTP_403_FORBIDDEN)
        return super().retrieve(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        company = self._company()
        if not user_has_permission_in_company(
            user=request.user,
            company=company,
            permission_code=PERMISSION_ACCOUNTING_POST,
        ):
            return response.Response({"detail": "Insufficient accounting post permission."}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)


class AccountTreeView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, company_id):
        company = get_company_for_user_or_404(user=request.user, company_id=company_id)
        if not user_has_permission_in_company(
            user=request.user,
            company=company,
            permission_code=PERMISSION_ACCOUNTING_VIEW,
        ):
            return response.Response({"detail": "Insufficient accounting view permission."}, status=status.HTTP_403_FORBIDDEN)

        roots = Account.objects.filter(company=company, parent__isnull=True).prefetch_related("children")
        serialized = AccountTreeSerializer(roots, many=True)
        return response.Response(serialized.data)
