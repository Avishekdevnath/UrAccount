from django.urls import path

from apps.sales.views import (
    ARAgingView,
    InvoiceDetailUpdateView,
    InvoiceLinesReplaceView,
    InvoiceListCreateView,
    InvoicePostView,
    InvoiceVoidView,
    ReceiptAllocationsReplaceView,
    ReceiptDetailUpdateView,
    ReceiptListCreateView,
    ReceiptPostView,
    ReceiptVoidView,
)

urlpatterns = [
    path("companies/<uuid:company_id>/invoices/", InvoiceListCreateView.as_view(), name="invoice_list_create"),
    path("companies/<uuid:company_id>/invoices/<uuid:invoice_id>/", InvoiceDetailUpdateView.as_view(), name="invoice_detail"),
    path(
        "companies/<uuid:company_id>/invoices/<uuid:invoice_id>/lines/",
        InvoiceLinesReplaceView.as_view(),
        name="invoice_lines_replace",
    ),
    path("companies/<uuid:company_id>/invoices/<uuid:invoice_id>/post/", InvoicePostView.as_view(), name="invoice_post"),
    path("companies/<uuid:company_id>/invoices/<uuid:invoice_id>/void/", InvoiceVoidView.as_view(), name="invoice_void"),
    path("companies/<uuid:company_id>/receipts/", ReceiptListCreateView.as_view(), name="receipt_list_create"),
    path("companies/<uuid:company_id>/receipts/<uuid:receipt_id>/", ReceiptDetailUpdateView.as_view(), name="receipt_detail"),
    path(
        "companies/<uuid:company_id>/receipts/<uuid:receipt_id>/allocations/",
        ReceiptAllocationsReplaceView.as_view(),
        name="receipt_allocations_replace",
    ),
    path("companies/<uuid:company_id>/receipts/<uuid:receipt_id>/post/", ReceiptPostView.as_view(), name="receipt_post"),
    path("companies/<uuid:company_id>/receipts/<uuid:receipt_id>/void/", ReceiptVoidView.as_view(), name="receipt_void"),
    path("companies/<uuid:company_id>/reports/ar-aging/", ARAgingView.as_view(), name="ar_aging"),
]
