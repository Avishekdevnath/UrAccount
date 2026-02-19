from django.contrib import admin

from apps.sales.models import Invoice, InvoiceLine, Receipt, ReceiptAllocation


class InvoiceLineInline(admin.TabularInline):
    model = InvoiceLine
    extra = 0


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ("company", "invoice_no", "customer", "status", "issue_date", "total", "amount_paid")
    list_filter = ("status",)
    inlines = [InvoiceLineInline]


@admin.register(InvoiceLine)
class InvoiceLineAdmin(admin.ModelAdmin):
    list_display = ("invoice", "line_no", "revenue_account", "quantity", "unit_price", "line_total")


class ReceiptAllocationInline(admin.TabularInline):
    model = ReceiptAllocation
    extra = 0


@admin.register(Receipt)
class ReceiptAdmin(admin.ModelAdmin):
    list_display = ("company", "receipt_no", "customer", "status", "received_date", "amount")
    list_filter = ("status",)
    inlines = [ReceiptAllocationInline]


@admin.register(ReceiptAllocation)
class ReceiptAllocationAdmin(admin.ModelAdmin):
    list_display = ("receipt", "invoice", "amount")
