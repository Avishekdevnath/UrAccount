from django.utils import timezone
from rest_framework import permissions, response, status, views

from apps.common.tenant import get_company_for_user_or_404, user_has_permission_in_company
from apps.rbac.constants import PERMISSION_ACCOUNTING_VIEW
from apps.reports.csv_export import (
    balance_sheet_csv_response,
    cash_flow_csv_response,
    general_ledger_csv_response,
    profit_loss_csv_response,
    trial_balance_csv_response,
)
from apps.reports.serializers import BalanceSheetQuerySerializer, DateRangeQuerySerializer, GeneralLedgerQuerySerializer
from apps.reports.services import (
    build_balance_sheet,
    build_cash_flow,
    build_general_ledger,
    build_profit_and_loss,
    build_trial_balance,
)


def _export_csv_enabled(request):
    return request.query_params.get("export", "").lower() == "csv"


class ProfitLossView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, company_id):
        company = get_company_for_user_or_404(user=request.user, company_id=company_id)
        if not user_has_permission_in_company(
            user=request.user,
            company=company,
            permission_code=PERMISSION_ACCOUNTING_VIEW,
        ):
            return response.Response({"detail": "Insufficient permission."}, status=status.HTTP_403_FORBIDDEN)

        query = DateRangeQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        payload = build_profit_and_loss(
            company=company,
            start_date=query.validated_data["start_date"],
            end_date=query.validated_data["end_date"],
        )
        if _export_csv_enabled(request):
            return profit_loss_csv_response(payload)
        return response.Response(payload)


class BalanceSheetView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, company_id):
        company = get_company_for_user_or_404(user=request.user, company_id=company_id)
        if not user_has_permission_in_company(
            user=request.user,
            company=company,
            permission_code=PERMISSION_ACCOUNTING_VIEW,
        ):
            return response.Response({"detail": "Insufficient permission."}, status=status.HTTP_403_FORBIDDEN)

        query = BalanceSheetQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        as_of = query.validated_data.get("as_of") or timezone.now().date()
        payload = build_balance_sheet(company=company, as_of=as_of)
        if _export_csv_enabled(request):
            return balance_sheet_csv_response(payload)
        return response.Response(payload)


class CashFlowView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, company_id):
        company = get_company_for_user_or_404(user=request.user, company_id=company_id)
        if not user_has_permission_in_company(
            user=request.user,
            company=company,
            permission_code=PERMISSION_ACCOUNTING_VIEW,
        ):
            return response.Response({"detail": "Insufficient permission."}, status=status.HTTP_403_FORBIDDEN)

        query = DateRangeQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        payload = build_cash_flow(
            company=company,
            start_date=query.validated_data["start_date"],
            end_date=query.validated_data["end_date"],
        )
        if _export_csv_enabled(request):
            return cash_flow_csv_response(payload)
        return response.Response(payload)


class TrialBalanceReportView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, company_id):
        company = get_company_for_user_or_404(user=request.user, company_id=company_id)
        if not user_has_permission_in_company(
            user=request.user,
            company=company,
            permission_code=PERMISSION_ACCOUNTING_VIEW,
        ):
            return response.Response({"detail": "Insufficient permission."}, status=status.HTTP_403_FORBIDDEN)

        query = DateRangeQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        payload = build_trial_balance(
            company=company,
            start_date=query.validated_data["start_date"],
            end_date=query.validated_data["end_date"],
        )
        if _export_csv_enabled(request):
            return trial_balance_csv_response(payload)
        return response.Response(payload)


class GeneralLedgerReportView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, company_id):
        company = get_company_for_user_or_404(user=request.user, company_id=company_id)
        if not user_has_permission_in_company(
            user=request.user,
            company=company,
            permission_code=PERMISSION_ACCOUNTING_VIEW,
        ):
            return response.Response({"detail": "Insufficient permission."}, status=status.HTTP_403_FORBIDDEN)

        query = GeneralLedgerQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        payload = build_general_ledger(
            company=company,
            start_date=query.validated_data["start_date"],
            end_date=query.validated_data["end_date"],
            account_id=query.validated_data.get("account_id"),
            limit=query.validated_data["limit"],
        )
        if _export_csv_enabled(request):
            return general_ledger_csv_response(payload)
        return response.Response(payload)
