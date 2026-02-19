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
from apps.purchases.models import Bill, VendorPayment
from apps.purchases.serializers import (
    APAgingQuerySerializer,
    BillLinesReplaceSerializer,
    BillSerializer,
    VendorPaymentAllocationsReplaceSerializer,
    VendorPaymentSerializer,
)
from apps.purchases.services import (
    PurchasesValidationError,
    build_ap_aging,
    post_bill,
    post_vendor_payment,
    replace_bill_lines,
    replace_vendor_payment_allocations,
    void_bill,
    void_vendor_payment,
)
from apps.rbac.constants import PERMISSION_ACCOUNTING_POST, PERMISSION_ACCOUNTING_VIEW


def _request_hash(data):
    raw = json.dumps(data, sort_keys=True, default=str)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _idempotency_scope(prefix, obj_id):
    return f"{prefix}:{obj_id}"


def _get_idempotency_key(request):
    return request.headers.get("Idempotency-Key")


class BillListCreateView(generics.ListCreateAPIView):
    serializer_class = BillSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = DefaultListPagination

    def _company(self):
        return get_company_for_user_or_404(user=self.request.user, company_id=self.kwargs["company_id"])

    def get_queryset(self):
        company = self._company()
        queryset = Bill.objects.filter(company=company).select_related("vendor", "ap_account")
        status_filter = self.request.query_params.get("status")
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        vendor_id = self.request.query_params.get("vendor_id")
        if vendor_id:
            queryset = queryset.filter(vendor_id=vendor_id)
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
        bill = serializer.save(company=company)
        return response.Response(self.get_serializer(bill).data, status=status.HTTP_201_CREATED)


class BillDetailUpdateView(generics.RetrieveUpdateAPIView):
    serializer_class = BillSerializer
    permission_classes = [permissions.IsAuthenticated]

    def _company(self):
        return get_company_for_user_or_404(user=self.request.user, company_id=self.kwargs["company_id"])

    def get_object(self):
        company = self._company()
        return generics.get_object_or_404(Bill, company=company, id=self.kwargs["bill_id"])

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
        bill = self.get_object()
        if bill.status != "draft":
            return response.Response({"detail": "Only draft bills can be edited."}, status=status.HTTP_400_BAD_REQUEST)
        serializer = self.get_serializer(
            bill,
            data=request.data,
            context={"company": company},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return response.Response(serializer.data)


class BillLinesReplaceView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def put(self, request, company_id, bill_id):
        company = get_company_for_user_or_404(user=request.user, company_id=company_id)
        if not user_has_permission_in_company(
            user=request.user,
            company=company,
            permission_code=PERMISSION_ACCOUNTING_POST,
        ):
            return response.Response({"detail": "Insufficient permission."}, status=status.HTTP_403_FORBIDDEN)

        bill = generics.get_object_or_404(Bill, company=company, id=bill_id)
        serializer = BillLinesReplaceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            payload = serializer.to_service_payload(company=company)
            replace_bill_lines(bill=bill, lines=payload)
        except PurchasesValidationError as exc:
            return response.Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return response.Response(BillSerializer(bill).data)


class BillPostView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, company_id, bill_id):
        company = get_company_for_user_or_404(user=request.user, company_id=company_id)
        if not user_has_permission_in_company(
            user=request.user,
            company=company,
            permission_code=PERMISSION_ACCOUNTING_POST,
        ):
            return response.Response({"detail": "Insufficient permission."}, status=status.HTTP_403_FORBIDDEN)
        bill = generics.get_object_or_404(Bill, company=company, id=bill_id)
        try:
            posted = post_bill(bill=bill, actor_user=request.user)
        except PurchasesValidationError as exc:
            return response.Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        log_audit_event(
            company=company,
            actor_user=request.user,
            action="bill.post",
            entity_type="bill",
            entity_id=posted.id,
            metadata={"bill_no": posted.bill_no},
            ip_address=request.META.get("REMOTE_ADDR"),
            user_agent=request.headers.get("User-Agent", ""),
        )
        return response.Response(BillSerializer(posted).data)


class BillVoidView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, company_id, bill_id):
        company = get_company_for_user_or_404(user=request.user, company_id=company_id)
        if not user_has_permission_in_company(
            user=request.user,
            company=company,
            permission_code=PERMISSION_ACCOUNTING_POST,
        ):
            return response.Response({"detail": "Insufficient permission."}, status=status.HTTP_403_FORBIDDEN)
        bill = generics.get_object_or_404(Bill, company=company, id=bill_id)
        try:
            voided = void_bill(bill=bill, actor_user=request.user)
        except PurchasesValidationError as exc:
            return response.Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        log_audit_event(
            company=company,
            actor_user=request.user,
            action="bill.void",
            entity_type="bill",
            entity_id=voided.id,
            metadata={"bill_no": voided.bill_no},
            ip_address=request.META.get("REMOTE_ADDR"),
            user_agent=request.headers.get("User-Agent", ""),
        )
        return response.Response(BillSerializer(voided).data)


class VendorPaymentListCreateView(generics.ListCreateAPIView):
    serializer_class = VendorPaymentSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = DefaultListPagination

    def _company(self):
        return get_company_for_user_or_404(user=self.request.user, company_id=self.kwargs["company_id"])

    def get_queryset(self):
        company = self._company()
        return VendorPayment.objects.filter(company=company).select_related("vendor", "payment_account")

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
        scope = "vendor-payments.create"
        request_hash = _request_hash(request.data)
        existing = get_valid_idempotency_record(company=company, scope=scope, idempotency_key=idem_key)
        if existing and existing.status == IdempotencyStatus.COMPLETED and existing.response_body:
            return response.Response(existing.response_body, status=status.HTTP_200_OK)

        serializer = self.get_serializer(data=request.data, context={"company": company})
        serializer.is_valid(raise_exception=True)
        vendor_payment = serializer.save(company=company)
        payload = self.get_serializer(vendor_payment).data
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


class VendorPaymentDetailUpdateView(generics.RetrieveUpdateAPIView):
    serializer_class = VendorPaymentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def _company(self):
        return get_company_for_user_or_404(user=self.request.user, company_id=self.kwargs["company_id"])

    def get_object(self):
        company = self._company()
        return generics.get_object_or_404(VendorPayment, company=company, id=self.kwargs["vendor_payment_id"])

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
        vendor_payment = self.get_object()
        if vendor_payment.status != "draft":
            return response.Response(
                {"detail": "Only draft vendor payments can be edited."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = self.get_serializer(
            vendor_payment,
            data=request.data,
            context={"company": company},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return response.Response(serializer.data)


class VendorPaymentAllocationsReplaceView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def put(self, request, company_id, vendor_payment_id):
        company = get_company_for_user_or_404(user=request.user, company_id=company_id)
        if not user_has_permission_in_company(
            user=request.user,
            company=company,
            permission_code=PERMISSION_ACCOUNTING_POST,
        ):
            return response.Response({"detail": "Insufficient permission."}, status=status.HTTP_403_FORBIDDEN)
        vendor_payment = generics.get_object_or_404(VendorPayment, company=company, id=vendor_payment_id)

        serializer = VendorPaymentAllocationsReplaceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            payload = serializer.to_service_payload(company=company)
            replace_vendor_payment_allocations(vendor_payment=vendor_payment, allocations=payload)
        except PurchasesValidationError as exc:
            return response.Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return response.Response(VendorPaymentSerializer(vendor_payment).data)


class VendorPaymentPostView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, company_id, vendor_payment_id):
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
        scope = _idempotency_scope("vendor-payments.post", vendor_payment_id)
        request_hash = _request_hash(request.data)
        existing = get_valid_idempotency_record(company=company, scope=scope, idempotency_key=idem_key)
        if existing and existing.status == IdempotencyStatus.COMPLETED and existing.response_body:
            return response.Response(existing.response_body, status=status.HTTP_200_OK)

        vendor_payment = generics.get_object_or_404(VendorPayment, company=company, id=vendor_payment_id)
        try:
            posted = post_vendor_payment(vendor_payment=vendor_payment, actor_user=request.user)
        except PurchasesValidationError as exc:
            return response.Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        payload = VendorPaymentSerializer(posted).data
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
            action="vendor_payment.post",
            entity_type="vendor_payment",
            entity_id=posted.id,
            metadata={"payment_no": posted.payment_no},
            ip_address=request.META.get("REMOTE_ADDR"),
            user_agent=request.headers.get("User-Agent", ""),
        )
        return response.Response(payload)


class VendorPaymentVoidView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, company_id, vendor_payment_id):
        company = get_company_for_user_or_404(user=request.user, company_id=company_id)
        if not user_has_permission_in_company(
            user=request.user,
            company=company,
            permission_code=PERMISSION_ACCOUNTING_POST,
        ):
            return response.Response({"detail": "Insufficient permission."}, status=status.HTTP_403_FORBIDDEN)
        vendor_payment = generics.get_object_or_404(VendorPayment, company=company, id=vendor_payment_id)
        try:
            voided = void_vendor_payment(vendor_payment=vendor_payment, actor_user=request.user)
        except PurchasesValidationError as exc:
            return response.Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        log_audit_event(
            company=company,
            actor_user=request.user,
            action="vendor_payment.void",
            entity_type="vendor_payment",
            entity_id=voided.id,
            metadata={"payment_no": voided.payment_no},
            ip_address=request.META.get("REMOTE_ADDR"),
            user_agent=request.headers.get("User-Agent", ""),
        )
        return response.Response(VendorPaymentSerializer(voided).data)


class APAgingView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, company_id):
        company = get_company_for_user_or_404(user=request.user, company_id=company_id)
        if not user_has_permission_in_company(
            user=request.user,
            company=company,
            permission_code=PERMISSION_ACCOUNTING_VIEW,
        ):
            return response.Response({"detail": "Insufficient permission."}, status=status.HTTP_403_FORBIDDEN)

        query = APAgingQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        as_of = query.validated_data.get("as_of") or timezone.now().date()
        rows = build_ap_aging(company=company, as_of_date=as_of)
        return response.Response(rows)
