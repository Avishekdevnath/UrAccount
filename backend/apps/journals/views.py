from django.db.models import Sum
from rest_framework import generics, permissions, response, status, views

from apps.audit.services import log_audit_event
from apps.common.pagination import DefaultListPagination
from apps.common.tenant import get_company_for_user_or_404, user_has_permission_in_company
from apps.journals.models import JournalEntry, JournalLine, JournalStatus
from apps.journals.serializers import JournalEntrySerializer, JournalLinesReplaceSerializer, JournalLineSerializer
from apps.journals.services import JournalValidationError, post_journal_entry, replace_journal_lines, void_journal_entry
from apps.rbac.constants import PERMISSION_ACCOUNTING_POST, PERMISSION_ACCOUNTING_VIEW


class JournalListCreateView(generics.ListCreateAPIView):
    serializer_class = JournalEntrySerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = DefaultListPagination

    def _company(self):
        return get_company_for_user_or_404(user=self.request.user, company_id=self.kwargs["company_id"])

    def get_queryset(self):
        company = self._company()
        if not user_has_permission_in_company(
            user=self.request.user,
            company=company,
            permission_code=PERMISSION_ACCOUNTING_VIEW,
        ):
            return JournalEntry.objects.none()
        return JournalEntry.objects.filter(company=company).prefetch_related("lines")

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

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        entry = serializer.save(company=company)
        return response.Response(self.get_serializer(entry).data, status=status.HTTP_201_CREATED)


class JournalDetailUpdateView(generics.RetrieveUpdateAPIView):
    serializer_class = JournalEntrySerializer
    permission_classes = [permissions.IsAuthenticated]

    def _company(self):
        return get_company_for_user_or_404(user=self.request.user, company_id=self.kwargs["company_id"])

    def get_object(self):
        company = self._company()
        return generics.get_object_or_404(JournalEntry, company=company, id=self.kwargs["journal_id"])

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
        entry = self.get_object()
        if entry.status != JournalStatus.DRAFT:
            return response.Response({"detail": "Only draft journals can be edited."}, status=status.HTTP_400_BAD_REQUEST)
        if not user_has_permission_in_company(
            user=request.user,
            company=company,
            permission_code=PERMISSION_ACCOUNTING_POST,
        ):
            return response.Response({"detail": "Insufficient accounting post permission."}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)


class JournalLinesReplaceView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def put(self, request, company_id, journal_id):
        company = get_company_for_user_or_404(user=request.user, company_id=company_id)
        if not user_has_permission_in_company(
            user=request.user,
            company=company,
            permission_code=PERMISSION_ACCOUNTING_POST,
        ):
            return response.Response({"detail": "Insufficient accounting post permission."}, status=status.HTTP_403_FORBIDDEN)

        entry = generics.get_object_or_404(JournalEntry, id=journal_id, company=company)
        serializer = JournalLinesReplaceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            payload = serializer.to_service_payload(company=company)
            replace_journal_lines(entry=entry, lines=payload)
        except JournalValidationError as exc:
            return response.Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        output = JournalEntrySerializer(entry)
        return response.Response(output.data)


class JournalPostView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, company_id, journal_id):
        company = get_company_for_user_or_404(user=request.user, company_id=company_id)
        if not user_has_permission_in_company(
            user=request.user,
            company=company,
            permission_code=PERMISSION_ACCOUNTING_POST,
        ):
            return response.Response({"detail": "Insufficient accounting post permission."}, status=status.HTTP_403_FORBIDDEN)

        entry = generics.get_object_or_404(JournalEntry, id=journal_id, company=company)
        try:
            posted = post_journal_entry(entry=entry, actor_user=request.user)
        except JournalValidationError as exc:
            return response.Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        log_audit_event(
            company=company,
            actor_user=request.user,
            action="journal.post",
            entity_type="journal_entry",
            entity_id=posted.id,
            metadata={"entry_no": posted.entry_no},
            ip_address=request.META.get("REMOTE_ADDR"),
            user_agent=request.headers.get("User-Agent", ""),
        )
        return response.Response(JournalEntrySerializer(posted).data)


class JournalVoidView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, company_id, journal_id):
        company = get_company_for_user_or_404(user=request.user, company_id=company_id)
        if not user_has_permission_in_company(
            user=request.user,
            company=company,
            permission_code=PERMISSION_ACCOUNTING_POST,
        ):
            return response.Response({"detail": "Insufficient accounting post permission."}, status=status.HTTP_403_FORBIDDEN)

        entry = generics.get_object_or_404(JournalEntry, id=journal_id, company=company)
        try:
            voided, reversal = void_journal_entry(entry=entry, actor_user=request.user)
        except JournalValidationError as exc:
            return response.Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        log_audit_event(
            company=company,
            actor_user=request.user,
            action="journal.void",
            entity_type="journal_entry",
            entity_id=voided.id,
            metadata={"reversal_id": str(reversal.id), "reversal_entry_no": reversal.entry_no},
            ip_address=request.META.get("REMOTE_ADDR"),
            user_agent=request.headers.get("User-Agent", ""),
        )
        return response.Response({"voided_id": str(voided.id), "reversal_id": str(reversal.id)})


class GeneralLedgerView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = DefaultListPagination

    def get(self, request, company_id):
        company = get_company_for_user_or_404(user=request.user, company_id=company_id)
        if not user_has_permission_in_company(
            user=request.user,
            company=company,
            permission_code=PERMISSION_ACCOUNTING_VIEW,
        ):
            return response.Response({"detail": "Insufficient accounting view permission."}, status=status.HTTP_403_FORBIDDEN)

        lines = JournalLine.objects.filter(
            company=company,
            journal_entry__status=JournalStatus.POSTED,
        ).select_related("account", "journal_entry")

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(lines, request, view=self)
        serializer = JournalLineSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class AccountLedgerView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = DefaultListPagination

    def get(self, request, company_id, account_id):
        company = get_company_for_user_or_404(user=request.user, company_id=company_id)
        if not user_has_permission_in_company(
            user=request.user,
            company=company,
            permission_code=PERMISSION_ACCOUNTING_VIEW,
        ):
            return response.Response({"detail": "Insufficient accounting view permission."}, status=status.HTTP_403_FORBIDDEN)

        lines = JournalLine.objects.filter(
            company=company,
            account_id=account_id,
            journal_entry__status=JournalStatus.POSTED,
        ).select_related("journal_entry", "account")

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(lines, request, view=self)
        serializer = JournalLineSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class TrialBalanceView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = DefaultListPagination

    def get(self, request, company_id):
        company = get_company_for_user_or_404(user=request.user, company_id=company_id)
        if not user_has_permission_in_company(
            user=request.user,
            company=company,
            permission_code=PERMISSION_ACCOUNTING_VIEW,
        ):
            return response.Response({"detail": "Insufficient accounting view permission."}, status=status.HTTP_403_FORBIDDEN)

        data = (
            JournalLine.objects.filter(company=company, journal_entry__status=JournalStatus.POSTED)
            .values("account__id", "account__code", "account__name")
            .annotate(total_debit=Sum("debit"), total_credit=Sum("credit"))
            .order_by("account__code")
        )
        paginator = self.pagination_class()
        page = paginator.paginate_queryset(data, request, view=self)
        return paginator.get_paginated_response(list(page))
