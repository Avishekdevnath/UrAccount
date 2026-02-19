import hashlib
import json
from datetime import timedelta

from django.utils import timezone
from rest_framework import generics, permissions, response, status, views

from apps.audit.services import log_audit_event
from apps.common.pagination import DefaultListPagination
from apps.common.tenant import get_company_for_user_or_404, user_has_permission_in_company
from apps.idempotency.models import IdempotencyStatus
from apps.idempotency.services import create_or_update_idempotency_record, get_valid_idempotency_record
from apps.rbac.constants import PERMISSION_ACCOUNTING_POST, PERMISSION_ACCOUNTING_VIEW
from apps.sales.models import Invoice, Receipt
from apps.sales.serializers import (
    ARAgingQuerySerializer,
    InvoiceLinesReplaceSerializer,
    InvoiceSerializer,
    ReceiptAllocationsReplaceSerializer,
    ReceiptSerializer,
)
from apps.sales.services import (
    SalesValidationError,
    build_ar_aging,
    post_invoice,
    post_receipt,
    replace_invoice_lines,
    replace_receipt_allocations,
    void_invoice,
    void_receipt,
)


def _request_hash(data):
    raw = json.dumps(data, sort_keys=True, default=str)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _idempotency_scope(prefix, obj_id):
    return f"{prefix}:{obj_id}"


def _get_idempotency_key(request):
    return request.headers.get("Idempotency-Key")


class InvoiceListCreateView(generics.ListCreateAPIView):
    serializer_class = InvoiceSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = DefaultListPagination

    def _company(self):
        return get_company_for_user_or_404(user=self.request.user, company_id=self.kwargs["company_id"])

    def get_queryset(self):
        company = self._company()
        queryset = Invoice.objects.filter(company=company).select_related("customer", "ar_account")
        status_filter = self.request.query_params.get("status")
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        customer_id = self.request.query_params.get("customer_id")
        if customer_id:
            queryset = queryset.filter(customer_id=customer_id)
        return queryset

    def list(self, request, *args, **kwargs):
        company = self._company()
        if not user_has_permission_in_company(
            user=request.user,
            company=company,
            permission_code=PERMISSION_ACCOUNTING_VIEW,
        ):
            return response.Response({"detail": "Insufficient permission."}, status=status.HTTP_403_FORBIDDEN)
        return super().list(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        company = self._company()
        if not user_has_permission_in_company(
            user=request.user,
            company=company,
            permission_code=PERMISSION_ACCOUNTING_POST,
        ):
            return response.Response({"detail": "Insufficient permission."}, status=status.HTTP_403_FORBIDDEN)
        serializer = self.get_serializer(data=request.data, context={"company": company})
        serializer.is_valid(raise_exception=True)
        invoice = serializer.save(company=company)
        return response.Response(self.get_serializer(invoice).data, status=status.HTTP_201_CREATED)


class InvoiceDetailUpdateView(generics.RetrieveUpdateAPIView):
    serializer_class = InvoiceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def _company(self):
        return get_company_for_user_or_404(user=self.request.user, company_id=self.kwargs["company_id"])

    def get_object(self):
        company = self._company()
        return generics.get_object_or_404(Invoice, company=company, id=self.kwargs["invoice_id"])

    def retrieve(self, request, *args, **kwargs):
        company = self._company()
        if not user_has_permission_in_company(
            user=request.user,
            company=company,
            permission_code=PERMISSION_ACCOUNTING_VIEW,
        ):
            return response.Response({"detail": "Insufficient permission."}, status=status.HTTP_403_FORBIDDEN)
        return super().retrieve(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        company = self._company()
        if not user_has_permission_in_company(
            user=request.user,
            company=company,
            permission_code=PERMISSION_ACCOUNTING_POST,
        ):
            return response.Response({"detail": "Insufficient permission."}, status=status.HTTP_403_FORBIDDEN)
        invoice = self.get_object()
        if invoice.status != "draft":
            return response.Response({"detail": "Only draft invoices can be edited."}, status=status.HTTP_400_BAD_REQUEST)
        return super().update(request, *args, **kwargs)


class InvoiceLinesReplaceView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def put(self, request, company_id, invoice_id):
        company = get_company_for_user_or_404(user=request.user, company_id=company_id)
        if not user_has_permission_in_company(
            user=request.user,
            company=company,
            permission_code=PERMISSION_ACCOUNTING_POST,
        ):
            return response.Response({"detail": "Insufficient permission."}, status=status.HTTP_403_FORBIDDEN)

        invoice = generics.get_object_or_404(Invoice, company=company, id=invoice_id)
        serializer = InvoiceLinesReplaceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            payload = serializer.to_service_payload(company=company)
            replace_invoice_lines(invoice=invoice, lines=payload)
        except SalesValidationError as exc:
            return response.Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return response.Response(InvoiceSerializer(invoice).data)


class InvoicePostView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, company_id, invoice_id):
        company = get_company_for_user_or_404(user=request.user, company_id=company_id)
        if not user_has_permission_in_company(
            user=request.user,
            company=company,
            permission_code=PERMISSION_ACCOUNTING_POST,
        ):
            return response.Response({"detail": "Insufficient permission."}, status=status.HTTP_403_FORBIDDEN)
        invoice = generics.get_object_or_404(Invoice, company=company, id=invoice_id)
        try:
            posted = post_invoice(invoice=invoice, actor_user=request.user)
        except SalesValidationError as exc:
            return response.Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        log_audit_event(
            company=company,
            actor_user=request.user,
            action="invoice.post",
            entity_type="invoice",
            entity_id=posted.id,
            metadata={"invoice_no": posted.invoice_no},
            ip_address=request.META.get("REMOTE_ADDR"),
            user_agent=request.headers.get("User-Agent", ""),
        )
        return response.Response(InvoiceSerializer(posted).data)


class InvoiceVoidView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, company_id, invoice_id):
        company = get_company_for_user_or_404(user=request.user, company_id=company_id)
        if not user_has_permission_in_company(
            user=request.user,
            company=company,
            permission_code=PERMISSION_ACCOUNTING_POST,
        ):
            return response.Response({"detail": "Insufficient permission."}, status=status.HTTP_403_FORBIDDEN)
        invoice = generics.get_object_or_404(Invoice, company=company, id=invoice_id)
        try:
            voided = void_invoice(invoice=invoice, actor_user=request.user)
        except SalesValidationError as exc:
            return response.Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        log_audit_event(
            company=company,
            actor_user=request.user,
            action="invoice.void",
            entity_type="invoice",
            entity_id=voided.id,
            metadata={"invoice_no": voided.invoice_no},
            ip_address=request.META.get("REMOTE_ADDR"),
            user_agent=request.headers.get("User-Agent", ""),
        )
        return response.Response(InvoiceSerializer(voided).data)


class ReceiptListCreateView(generics.ListCreateAPIView):
    serializer_class = ReceiptSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = DefaultListPagination

    def _company(self):
        return get_company_for_user_or_404(user=self.request.user, company_id=self.kwargs["company_id"])

    def get_queryset(self):
        company = self._company()
        return Receipt.objects.filter(company=company).select_related("customer", "deposit_account")

    def list(self, request, *args, **kwargs):
        company = self._company()
        if not user_has_permission_in_company(
            user=request.user,
            company=company,
            permission_code=PERMISSION_ACCOUNTING_VIEW,
        ):
            return response.Response({"detail": "Insufficient permission."}, status=status.HTTP_403_FORBIDDEN)
        return super().list(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        company = self._company()
        if not user_has_permission_in_company(
            user=request.user,
            company=company,
            permission_code=PERMISSION_ACCOUNTING_POST,
        ):
            return response.Response({"detail": "Insufficient permission."}, status=status.HTTP_403_FORBIDDEN)

        idem_key = _get_idempotency_key(request)
        if not idem_key:
            return response.Response({"detail": "Idempotency-Key header required."}, status=status.HTTP_400_BAD_REQUEST)
        scope = "receipts.create"
        request_hash = _request_hash(request.data)
        existing = get_valid_idempotency_record(company=company, scope=scope, idempotency_key=idem_key)
        if existing and existing.status == IdempotencyStatus.COMPLETED and existing.response_body:
            return response.Response(existing.response_body, status=status.HTTP_200_OK)

        serializer = self.get_serializer(data=request.data, context={"company": company})
        serializer.is_valid(raise_exception=True)
        receipt = serializer.save(company=company)
        payload = self.get_serializer(receipt).data
        create_or_update_idempotency_record(
            company=company,
            scope=scope,
            idempotency_key=idem_key,
            request_hash=request_hash,
            expires_at=timezone.now() + timedelta(hours=24),
            status=IdempotencyStatus.COMPLETED,
            response_body=payload,
        )
        return response.Response(payload, status=status.HTTP_201_CREATED)


class ReceiptDetailUpdateView(generics.RetrieveUpdateAPIView):
    serializer_class = ReceiptSerializer
    permission_classes = [permissions.IsAuthenticated]

    def _company(self):
        return get_company_for_user_or_404(user=self.request.user, company_id=self.kwargs["company_id"])

    def get_object(self):
        company = self._company()
        return generics.get_object_or_404(Receipt, company=company, id=self.kwargs["receipt_id"])

    def retrieve(self, request, *args, **kwargs):
        company = self._company()
        if not user_has_permission_in_company(
            user=request.user,
            company=company,
            permission_code=PERMISSION_ACCOUNTING_VIEW,
        ):
            return response.Response({"detail": "Insufficient permission."}, status=status.HTTP_403_FORBIDDEN)
        return super().retrieve(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        company = self._company()
        if not user_has_permission_in_company(
            user=request.user,
            company=company,
            permission_code=PERMISSION_ACCOUNTING_POST,
        ):
            return response.Response({"detail": "Insufficient permission."}, status=status.HTTP_403_FORBIDDEN)
        receipt = self.get_object()
        if receipt.status != "draft":
            return response.Response({"detail": "Only draft receipts can be edited."}, status=status.HTTP_400_BAD_REQUEST)
        return super().update(request, *args, **kwargs)


class ReceiptAllocationsReplaceView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def put(self, request, company_id, receipt_id):
        company = get_company_for_user_or_404(user=request.user, company_id=company_id)
        if not user_has_permission_in_company(
            user=request.user,
            company=company,
            permission_code=PERMISSION_ACCOUNTING_POST,
        ):
            return response.Response({"detail": "Insufficient permission."}, status=status.HTTP_403_FORBIDDEN)
        receipt = generics.get_object_or_404(Receipt, company=company, id=receipt_id)

        serializer = ReceiptAllocationsReplaceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            payload = serializer.to_service_payload(company=company)
            replace_receipt_allocations(receipt=receipt, allocations=payload)
        except SalesValidationError as exc:
            return response.Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return response.Response(ReceiptSerializer(receipt).data)


class ReceiptPostView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, company_id, receipt_id):
        company = get_company_for_user_or_404(user=request.user, company_id=company_id)
        if not user_has_permission_in_company(
            user=request.user,
            company=company,
            permission_code=PERMISSION_ACCOUNTING_POST,
        ):
            return response.Response({"detail": "Insufficient permission."}, status=status.HTTP_403_FORBIDDEN)

        idem_key = _get_idempotency_key(request)
        if not idem_key:
            return response.Response({"detail": "Idempotency-Key header required."}, status=status.HTTP_400_BAD_REQUEST)
        scope = _idempotency_scope("receipts.post", receipt_id)
        request_hash = _request_hash(request.data)
        existing = get_valid_idempotency_record(company=company, scope=scope, idempotency_key=idem_key)
        if existing and existing.status == IdempotencyStatus.COMPLETED and existing.response_body:
            return response.Response(existing.response_body, status=status.HTTP_200_OK)

        receipt = generics.get_object_or_404(Receipt, company=company, id=receipt_id)
        try:
            posted = post_receipt(receipt=receipt, actor_user=request.user)
        except SalesValidationError as exc:
            return response.Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        payload = ReceiptSerializer(posted).data
        create_or_update_idempotency_record(
            company=company,
            scope=scope,
            idempotency_key=idem_key,
            request_hash=request_hash,
            expires_at=timezone.now() + timedelta(hours=24),
            status=IdempotencyStatus.COMPLETED,
            response_body=payload,
        )
        log_audit_event(
            company=company,
            actor_user=request.user,
            action="receipt.post",
            entity_type="receipt",
            entity_id=posted.id,
            metadata={"receipt_no": posted.receipt_no},
            ip_address=request.META.get("REMOTE_ADDR"),
            user_agent=request.headers.get("User-Agent", ""),
        )
        return response.Response(payload)


class ReceiptVoidView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, company_id, receipt_id):
        company = get_company_for_user_or_404(user=request.user, company_id=company_id)
        if not user_has_permission_in_company(
            user=request.user,
            company=company,
            permission_code=PERMISSION_ACCOUNTING_POST,
        ):
            return response.Response({"detail": "Insufficient permission."}, status=status.HTTP_403_FORBIDDEN)
        receipt = generics.get_object_or_404(Receipt, company=company, id=receipt_id)
        try:
            voided = void_receipt(receipt=receipt, actor_user=request.user)
        except SalesValidationError as exc:
            return response.Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        log_audit_event(
            company=company,
            actor_user=request.user,
            action="receipt.void",
            entity_type="receipt",
            entity_id=voided.id,
            metadata={"receipt_no": voided.receipt_no},
            ip_address=request.META.get("REMOTE_ADDR"),
            user_agent=request.headers.get("User-Agent", ""),
        )
        return response.Response(ReceiptSerializer(voided).data)


class ARAgingView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, company_id):
        company = get_company_for_user_or_404(user=request.user, company_id=company_id)
        if not user_has_permission_in_company(
            user=request.user,
            company=company,
            permission_code=PERMISSION_ACCOUNTING_VIEW,
        ):
            return response.Response({"detail": "Insufficient permission."}, status=status.HTTP_403_FORBIDDEN)

        query = ARAgingQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        as_of = query.validated_data.get("as_of") or timezone.now().date()
        rows = build_ar_aging(company=company, as_of_date=as_of)
        return response.Response(rows)

