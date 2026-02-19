from django.urls import path

from apps.purchases.views import (
    APAgingView,
    BillDetailUpdateView,
    BillLinesReplaceView,
    BillListCreateView,
    BillPostView,
    BillVoidView,
    VendorPaymentAllocationsReplaceView,
    VendorPaymentDetailUpdateView,
    VendorPaymentListCreateView,
    VendorPaymentPostView,
    VendorPaymentVoidView,
)

urlpatterns = [
    path("companies/<uuid:company_id>/bills/", BillListCreateView.as_view(), name="bill_list_create"),
    path("companies/<uuid:company_id>/bills/<uuid:bill_id>/", BillDetailUpdateView.as_view(), name="bill_detail"),
    path(
        "companies/<uuid:company_id>/bills/<uuid:bill_id>/lines/",
        BillLinesReplaceView.as_view(),
        name="bill_lines_replace",
    ),
    path("companies/<uuid:company_id>/bills/<uuid:bill_id>/post/", BillPostView.as_view(), name="bill_post"),
    path("companies/<uuid:company_id>/bills/<uuid:bill_id>/void/", BillVoidView.as_view(), name="bill_void"),
    path(
        "companies/<uuid:company_id>/vendor-payments/",
        VendorPaymentListCreateView.as_view(),
        name="vendor_payment_list_create",
    ),
    path(
        "companies/<uuid:company_id>/vendor-payments/<uuid:vendor_payment_id>/",
        VendorPaymentDetailUpdateView.as_view(),
        name="vendor_payment_detail",
    ),
    path(
        "companies/<uuid:company_id>/vendor-payments/<uuid:vendor_payment_id>/allocations/",
        VendorPaymentAllocationsReplaceView.as_view(),
        name="vendor_payment_allocations_replace",
    ),
    path(
        "companies/<uuid:company_id>/vendor-payments/<uuid:vendor_payment_id>/post/",
        VendorPaymentPostView.as_view(),
        name="vendor_payment_post",
    ),
    path(
        "companies/<uuid:company_id>/vendor-payments/<uuid:vendor_payment_id>/void/",
        VendorPaymentVoidView.as_view(),
        name="vendor_payment_void",
    ),
    path("companies/<uuid:company_id>/reports/ap-aging/", APAgingView.as_view(), name="ap_aging"),
]
