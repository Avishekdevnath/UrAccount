from django.urls import path

from apps.contacts.views import ContactDetailView, ContactListCreateView

urlpatterns = [
    path("companies/<uuid:company_id>/contacts/", ContactListCreateView.as_view(), name="contact_list_create"),
    path("companies/<uuid:company_id>/contacts/<uuid:contact_id>/", ContactDetailView.as_view(), name="contact_detail"),
]
