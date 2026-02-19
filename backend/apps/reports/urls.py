from django.urls import path

from apps.reports.views import BalanceSheetView, CashFlowView, GeneralLedgerReportView, ProfitLossView, TrialBalanceReportView

urlpatterns = [
    path("companies/<uuid:company_id>/profit-loss/", ProfitLossView.as_view(), name="report_profit_loss"),
    path("companies/<uuid:company_id>/balance-sheet/", BalanceSheetView.as_view(), name="report_balance_sheet"),
    path("companies/<uuid:company_id>/cash-flow/", CashFlowView.as_view(), name="report_cash_flow"),
    path("companies/<uuid:company_id>/trial-balance/", TrialBalanceReportView.as_view(), name="report_trial_balance"),
    path("companies/<uuid:company_id>/general-ledger/", GeneralLedgerReportView.as_view(), name="report_general_ledger"),
]
