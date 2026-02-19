from rest_framework import generics, permissions, response, status, views

from apps.audit.services import log_audit_event
from apps.banking.models import BankReconciliation, BankStatementImport, BankTransaction
from apps.banking.serializers import (
    BankAccountSerializer,
    BankReconciliationSerializer,
    BankStatementImportSerializer,
    BankTransactionSerializer,
    ReconciliationLinesReplaceSerializer,
    TransactionMatchSerializer,
)
from apps.banking.services import (
    BankingValidationError,
    finalize_reconciliation,
    match_bank_transaction,
    parse_statement_import,
    replace_reconciliation_lines,
)
from apps.common.tenant import get_company_for_user_or_404, user_has_permission_in_company
from apps.rbac.constants import PERMISSION_ACCOUNTING_POST, PERMISSION_ACCOUNTING_VIEW


class BankAccountListCreateView(generics.ListCreateAPIView):
    serializer_class = BankAccountSerializer
    permission_classes = [permissions.IsAuthenticated]

    def _company(self):
        return get_company_for_user_or_404(user=self.request.user, company_id=self.kwargs["company_id"])

    def get_queryset(self):
        company = self._company()
        return company.bank_accounts.all()

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
        serializer.save(company=company)
        return response.Response(serializer.data, status=status.HTTP_201_CREATED)


class BankAccountDetailUpdateView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = BankAccountSerializer
    permission_classes = [permissions.IsAuthenticated]

    def _company(self):
        return get_company_for_user_or_404(user=self.request.user, company_id=self.kwargs["company_id"])

    def get_object(self):
        company = self._company()
        return generics.get_object_or_404(company.bank_accounts.all(), id=self.kwargs["bank_account_id"])

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
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, context={"company": company})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return response.Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        company = self._company()
        if not user_has_permission_in_company(
            user=request.user,
            company=company,
            permission_code=PERMISSION_ACCOUNTING_POST,
        ):
            return response.Response({"detail": "Insufficient permission."}, status=status.HTTP_403_FORBIDDEN)

        instance = self.get_object()
        if (
            instance.imports.exists()
            or instance.transactions.exists()
            or instance.reconciliations.exists()
        ):
            return response.Response(
                {"detail": "Bank account cannot be deleted because dependent records exist."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        instance.delete()
        return response.Response(status=status.HTTP_204_NO_CONTENT)


class BankStatementImportListCreateView(generics.ListCreateAPIView):
    serializer_class = BankStatementImportSerializer
    permission_classes = [permissions.IsAuthenticated]

    def _company(self):
        return get_company_for_user_or_404(user=self.request.user, company_id=self.kwargs["company_id"])

    def get_queryset(self):
        company = self._company()
        queryset = BankStatementImport.objects.filter(company=company).select_related("bank_account")
        status_filter = self.request.query_params.get("status")
        if status_filter:
            queryset = queryset.filter(status=status_filter)
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
        statement_import = serializer.save(company=company, imported_by_user=request.user)
        try:
            created_count = parse_statement_import(statement_import=statement_import)
        except BankingValidationError as exc:
            return response.Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        output = self.get_serializer(statement_import)
        payload = output.data
        payload["transactions_created"] = created_count
        return response.Response(payload, status=status.HTTP_201_CREATED)


class BankTransactionListView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, company_id):
        company = get_company_for_user_or_404(user=request.user, company_id=company_id)
        if not user_has_permission_in_company(
            user=request.user,
            company=company,
            permission_code=PERMISSION_ACCOUNTING_VIEW,
        ):
            return response.Response({"detail": "Insufficient permission."}, status=status.HTTP_403_FORBIDDEN)

        queryset = BankTransaction.objects.filter(company=company).select_related("bank_account", "matched_journal_entry")
        bank_account_id = request.query_params.get("bank_account_id")
        if bank_account_id:
            queryset = queryset.filter(bank_account_id=bank_account_id)
        status_filter = request.query_params.get("status")
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        date_from = request.query_params.get("date_from")
        if date_from:
            queryset = queryset.filter(txn_date__gte=date_from)
        date_to = request.query_params.get("date_to")
        if date_to:
            queryset = queryset.filter(txn_date__lte=date_to)

        limit_raw = request.query_params.get("limit")
        limit = 200
        if limit_raw:
            try:
                limit = min(max(int(limit_raw), 1), 500)
            except ValueError:
                return response.Response({"detail": "limit must be an integer."}, status=status.HTTP_400_BAD_REQUEST)

        serializer = BankTransactionSerializer(queryset[:limit], many=True)
        return response.Response(serializer.data)


class BankTransactionMatchView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, company_id, transaction_id):
        company = get_company_for_user_or_404(user=request.user, company_id=company_id)
        if not user_has_permission_in_company(
            user=request.user,
            company=company,
            permission_code=PERMISSION_ACCOUNTING_POST,
        ):
            return response.Response({"detail": "Insufficient permission."}, status=status.HTTP_403_FORBIDDEN)

        transaction_obj = generics.get_object_or_404(BankTransaction, company=company, id=transaction_id)
        serializer = TransactionMatchSerializer(data=request.data, context={"company": company})
        serializer.is_valid(raise_exception=True)
        journal_entry = serializer.context["journal_entry"]
        try:
            matched = match_bank_transaction(bank_transaction=transaction_obj, journal_entry=journal_entry)
        except BankingValidationError as exc:
            return response.Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        log_audit_event(
            company=company,
            actor_user=request.user,
            action="bank_transaction.match",
            entity_type="bank_transaction",
            entity_id=matched.id,
            metadata={"journal_entry_id": str(journal_entry.id)},
            ip_address=request.META.get("REMOTE_ADDR"),
            user_agent=request.headers.get("User-Agent", ""),
        )
        return response.Response(BankTransactionSerializer(matched).data)


class BankReconciliationListCreateView(generics.ListCreateAPIView):
    serializer_class = BankReconciliationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def _company(self):
        return get_company_for_user_or_404(user=self.request.user, company_id=self.kwargs["company_id"])

    def get_queryset(self):
        company = self._company()
        return BankReconciliation.objects.filter(company=company).select_related("bank_account")

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
        serializer.save(company=company)
        return response.Response(serializer.data, status=status.HTTP_201_CREATED)


class BankReconciliationDetailView(generics.RetrieveAPIView):
    serializer_class = BankReconciliationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        company = get_company_for_user_or_404(user=self.request.user, company_id=self.kwargs["company_id"])
        return generics.get_object_or_404(BankReconciliation, company=company, id=self.kwargs["reconciliation_id"])

    def retrieve(self, request, *args, **kwargs):
        company = get_company_for_user_or_404(user=request.user, company_id=self.kwargs["company_id"])
        if not user_has_permission_in_company(
            user=request.user,
            company=company,
            permission_code=PERMISSION_ACCOUNTING_VIEW,
        ):
            return response.Response({"detail": "Insufficient permission."}, status=status.HTTP_403_FORBIDDEN)
        reconciliation = self.get_object()
        payload = BankReconciliationSerializer(reconciliation).data
        payload["lines"] = [
            {
                "id": str(line.id),
                "bank_transaction_id": str(line.bank_transaction_id),
            }
            for line in reconciliation.lines.all()
        ]
        return response.Response(payload)


class BankReconciliationLinesReplaceView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def put(self, request, company_id, reconciliation_id):
        company = get_company_for_user_or_404(user=request.user, company_id=company_id)
        if not user_has_permission_in_company(
            user=request.user,
            company=company,
            permission_code=PERMISSION_ACCOUNTING_POST,
        ):
            return response.Response({"detail": "Insufficient permission."}, status=status.HTTP_403_FORBIDDEN)

        reconciliation = generics.get_object_or_404(BankReconciliation, company=company, id=reconciliation_id)
        serializer = ReconciliationLinesReplaceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            transactions = serializer.to_service_payload(company=company)
            replace_reconciliation_lines(reconciliation=reconciliation, transactions=transactions)
        except BankingValidationError as exc:
            return response.Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return response.Response(BankReconciliationSerializer(reconciliation).data)


class BankReconciliationFinalizeView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, company_id, reconciliation_id):
        company = get_company_for_user_or_404(user=request.user, company_id=company_id)
        if not user_has_permission_in_company(
            user=request.user,
            company=company,
            permission_code=PERMISSION_ACCOUNTING_POST,
        ):
            return response.Response({"detail": "Insufficient permission."}, status=status.HTTP_403_FORBIDDEN)
        reconciliation = generics.get_object_or_404(BankReconciliation, company=company, id=reconciliation_id)
        try:
            finalized = finalize_reconciliation(reconciliation=reconciliation, actor_user=request.user)
        except BankingValidationError as exc:
            return response.Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        log_audit_event(
            company=company,
            actor_user=request.user,
            action="bank_reconciliation.finalize",
            entity_type="bank_reconciliation",
            entity_id=finalized.id,
            metadata={"bank_account_id": str(finalized.bank_account_id)},
            ip_address=request.META.get("REMOTE_ADDR"),
            user_agent=request.headers.get("User-Agent", ""),
        )
        return response.Response(BankReconciliationSerializer(finalized).data)
