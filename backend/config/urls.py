"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""

from django.conf import settings
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/auth/", include("apps.users.urls")),
    path("api/v1/companies/", include("apps.companies.urls")),
    path("api/v1/rbac/", include("apps.rbac.urls")),
    path("api/v1/accounting/", include("apps.accounting.urls")),
    path("api/v1/journals/", include("apps.journals.urls")),
    path("api/v1/contacts/", include("apps.contacts.urls")),
    path("api/v1/sales/", include("apps.sales.urls")),
    path("api/v1/purchases/", include("apps.purchases.urls")),
    path("api/v1/banking/", include("apps.banking.urls")),
    path("api/v1/reports/", include("apps.reports.urls")),
    path("api/v1/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/v1/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
]

if settings.ENABLE_BROWSABLE_API:
    urlpatterns.insert(1, path("api-auth/", include("rest_framework.urls")))

if settings.SYSTEM_ADMIN_ENABLED:
    urlpatterns.append(path("api/v1/system/", include("apps.system_admin.urls")))
