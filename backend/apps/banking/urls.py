from django.urls import path

from apps.banking.views import (
    BankAccountDetailUpdateView,
    BankAccountListCreateView,
    BankReconciliationDetailView,
    BankReconciliationFinalizeView,
    BankReconciliationLinesReplaceView,
    BankReconciliationListCreateView,
    BankStatementImportListCreateView,
    BankTransactionListView,
    BankTransactionMatchView,
)

urlpatterns = [
    path("companies/<uuid:company_id>/bank-accounts/", BankAccountListCreateView.as_view(), name="bank_account_list_create"),
    path(
        "companies/<uuid:company_id>/bank-accounts/<uuid:bank_account_id>/",
        BankAccountDetailUpdateView.as_view(),
        name="bank_account_detail",
    ),
    path("companies/<uuid:company_id>/imports/", BankStatementImportListCreateView.as_view(), name="bank_imports"),
    path("companies/<uuid:company_id>/transactions/", BankTransactionListView.as_view(), name="bank_transactions"),
    path(
        "companies/<uuid:company_id>/transactions/<uuid:transaction_id>/match/",
        BankTransactionMatchView.as_view(),
        name="bank_transaction_match",
    ),
    path(
        "companies/<uuid:company_id>/reconciliations/",
        BankReconciliationListCreateView.as_view(),
        name="bank_reconciliation_list_create",
    ),
    path(
        "companies/<uuid:company_id>/reconciliations/<uuid:reconciliation_id>/",
        BankReconciliationDetailView.as_view(),
        name="bank_reconciliation_detail",
    ),
    path(
        "companies/<uuid:company_id>/reconciliations/<uuid:reconciliation_id>/lines/",
        BankReconciliationLinesReplaceView.as_view(),
        name="bank_reconciliation_lines_replace",
    ),
    path(
        "companies/<uuid:company_id>/reconciliations/<uuid:reconciliation_id>/finalize/",
        BankReconciliationFinalizeView.as_view(),
        name="bank_reconciliation_finalize",
    ),
]
