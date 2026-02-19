from django.urls import path

from apps.accounting.views import AccountDetailView, AccountListCreateView, AccountTreeView

urlpatterns = [
    path("companies/<uuid:company_id>/accounts/", AccountListCreateView.as_view(), name="account_list_create"),
    path("companies/<uuid:company_id>/accounts/tree/", AccountTreeView.as_view(), name="account_tree"),
    path("companies/<uuid:company_id>/accounts/<uuid:account_id>/", AccountDetailView.as_view(), name="account_detail"),
]
