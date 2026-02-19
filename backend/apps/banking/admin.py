from django.contrib import admin

from apps.banking.models import (
    BankAccount,
    BankReconciliation,
    BankReconciliationLine,
    BankStatementImport,
    BankTransaction,
)


@admin.register(BankAccount)
class BankAccountAdmin(admin.ModelAdmin):
    list_display = ("id", "company", "name", "currency_code", "ledger_account", "is_active")
    list_filter = ("company", "is_active")
    search_fields = ("name", "account_number_last4")


@admin.register(BankStatementImport)
class BankStatementImportAdmin(admin.ModelAdmin):
    list_display = ("id", "company", "bank_account", "file_name", "status", "created_at")
    list_filter = ("company", "status")
    search_fields = ("file_name",)


@admin.register(BankTransaction)
class BankTransactionAdmin(admin.ModelAdmin):
    list_display = ("id", "company", "bank_account", "txn_date", "amount", "status")
    list_filter = ("company", "status")
    search_fields = ("description", "reference")


@admin.register(BankReconciliation)
class BankReconciliationAdmin(admin.ModelAdmin):
    list_display = ("id", "company", "bank_account", "start_date", "end_date", "status")
    list_filter = ("company", "status")


@admin.register(BankReconciliationLine)
class BankReconciliationLineAdmin(admin.ModelAdmin):
    list_display = ("id", "reconciliation", "bank_transaction")
    list_filter = ("company",)
