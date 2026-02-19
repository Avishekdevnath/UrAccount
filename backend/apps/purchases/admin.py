from django.contrib import admin

from apps.purchases.models import Bill, BillLine, VendorPayment, VendorPaymentAllocation


@admin.register(Bill)
class BillAdmin(admin.ModelAdmin):
    list_display = ("id", "company", "bill_no", "status", "vendor", "bill_date", "total", "amount_paid")
    list_filter = ("status", "company")
    search_fields = ("bill_no", "vendor__name")


@admin.register(BillLine)
class BillLineAdmin(admin.ModelAdmin):
    list_display = ("id", "bill", "line_no", "expense_account", "line_total")
    list_filter = ("company",)
    search_fields = ("bill__bill_no", "description")


@admin.register(VendorPayment)
class VendorPaymentAdmin(admin.ModelAdmin):
    list_display = ("id", "company", "payment_no", "status", "vendor", "paid_date", "amount")
    list_filter = ("status", "company")
    search_fields = ("payment_no", "vendor__name")


@admin.register(VendorPaymentAllocation)
class VendorPaymentAllocationAdmin(admin.ModelAdmin):
    list_display = ("id", "vendor_payment", "bill", "amount")
    list_filter = ("company",)
