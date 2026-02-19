from django.urls import path

from apps.journals.views import (
    AccountLedgerView,
    GeneralLedgerView,
    JournalDetailUpdateView,
    JournalLinesReplaceView,
    JournalListCreateView,
    JournalPostView,
    JournalVoidView,
    TrialBalanceView,
)

urlpatterns = [
    path("companies/<uuid:company_id>/journals/", JournalListCreateView.as_view(), name="journal_list_create"),
    path("companies/<uuid:company_id>/journals/<uuid:journal_id>/", JournalDetailUpdateView.as_view(), name="journal_detail"),
    path(
        "companies/<uuid:company_id>/journals/<uuid:journal_id>/lines/",
        JournalLinesReplaceView.as_view(),
        name="journal_replace_lines",
    ),
    path(
        "companies/<uuid:company_id>/journals/<uuid:journal_id>/post/",
        JournalPostView.as_view(),
        name="journal_post",
    ),
    path(
        "companies/<uuid:company_id>/journals/<uuid:journal_id>/void/",
        JournalVoidView.as_view(),
        name="journal_void",
    ),
    path("companies/<uuid:company_id>/ledger/general/", GeneralLedgerView.as_view(), name="general_ledger"),
    path(
        "companies/<uuid:company_id>/ledger/accounts/<uuid:account_id>/",
        AccountLedgerView.as_view(),
        name="account_ledger",
    ),
    path("companies/<uuid:company_id>/ledger/trial-balance/", TrialBalanceView.as_view(), name="trial_balance"),
]
