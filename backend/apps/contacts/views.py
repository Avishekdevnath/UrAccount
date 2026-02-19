from django.db.models.deletion import ProtectedError
from rest_framework import generics, permissions, response, status

from apps.common.tenant import get_company_for_user_or_404, user_has_permission_in_company
from apps.contacts.models import Contact
from apps.contacts.serializers import ContactSerializer
from apps.rbac.constants import PERMISSION_ACCOUNTING_POST, PERMISSION_ACCOUNTING_VIEW


class ContactListCreateView(generics.ListCreateAPIView):
    serializer_class = ContactSerializer
    permission_classes = [permissions.IsAuthenticated]

    def _company(self):
        return get_company_for_user_or_404(user=self.request.user, company_id=self.kwargs["company_id"])

    def get_queryset(self):
        company = self._company()
        queryset = Contact.objects.filter(company=company)
        contact_type = self.request.query_params.get("type")
        if contact_type:
            queryset = queryset.filter(type=contact_type)
        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(name__icontains=search)
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
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(company=company)
        return response.Response(serializer.data, status=status.HTTP_201_CREATED)


class ContactDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ContactSerializer
    permission_classes = [permissions.IsAuthenticated]

    def _company(self):
        return get_company_for_user_or_404(user=self.request.user, company_id=self.kwargs["company_id"])

    def get_object(self):
        company = self._company()
        return generics.get_object_or_404(Contact, company=company, id=self.kwargs["contact_id"])

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
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        company = self._company()
        if not user_has_permission_in_company(
            user=request.user,
            company=company,
            permission_code=PERMISSION_ACCOUNTING_POST,
        ):
            return response.Response({"detail": "Insufficient permission."}, status=status.HTTP_403_FORBIDDEN)

        instance = self.get_object()
        try:
            instance.delete()
        except ProtectedError:
            return response.Response(
                {"detail": "Contact cannot be deleted because it is used by financial records."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return response.Response(status=status.HTTP_204_NO_CONTENT)
