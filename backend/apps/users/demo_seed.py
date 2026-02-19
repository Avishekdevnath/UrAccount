from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from apps.accounting.models import Account, AccountType, NormalBalance
from apps.banking.models import BankAccount, BankReconciliation, BankStatementImport, BankTransactionStatus, ReconciliationStatus
from apps.banking.services import finalize_reconciliation, match_bank_transaction, parse_statement_import, replace_reconciliation_lines
from apps.companies.models import Company, CompanyMember, CompanyMemberStatus
from apps.companies.services import create_company_for_user
from apps.contacts.models import Contact, ContactType
from apps.journals.models import JournalEntry, JournalStatus
from apps.purchases.models import Bill, BillStatus, VendorPayment, VendorPaymentStatus
from apps.purchases.services import post_bill, post_vendor_payment, replace_bill_lines, replace_vendor_payment_allocations
from apps.rbac.constants import ROLE_ACCOUNTANT, ROLE_ADMIN, ROLE_OWNER, ROLE_VIEWER
from apps.rbac.models import CompanyRole, CompanyRoleAssignment
from apps.rbac.services import assign_owner_role, ensure_default_roles_for_company
from apps.sales.models import Invoice, InvoiceStatus, Receipt, ReceiptStatus
from apps.sales.services import post_invoice, post_receipt, replace_invoice_lines, replace_receipt_allocations
from apps.users.models import User

DEMO_PASSWORD = "Demo@12345"
DEMO_COMPANY_NAME = "Demo Company"
DEMO_COMPANY_SLUG = "demo-company"

DEMO_INVOICE_NOTE = "seed:demo-invoice"
DEMO_RECEIPT_NOTE = "seed:demo-receipt"
DEMO_BILL_NOTE = "seed:demo-bill"
DEMO_VENDOR_PAYMENT_NOTE = "seed:demo-vendor-payment"

DEMO_BANK_ACCOUNT_NAME = "Demo Operating Bank"
DEMO_STATEMENT_FILE_NAME = "seed_demo_statement.csv"


def _upsert_user(*, email: str, full_name: str, password: str, is_staff: bool = False) -> User:
    user, _ = User.objects.get_or_create(
        email=email,
        defaults={"full_name": full_name, "is_active": True, "is_staff": is_staff},
    )
    user.full_name = full_name
    user.is_active = True
    user.is_staff = is_staff
    user.set_password(password)
    user.save(update_fields=["full_name", "is_active", "is_staff", "password"])
    return user


def _ensure_company(owner: User) -> Company:
    company = Company.objects.filter(slug=DEMO_COMPANY_SLUG).first()
    if company is None:
        company = create_company_for_user(
            user=owner,
            company_data={
                "name": DEMO_COMPANY_NAME,
                "slug": DEMO_COMPANY_SLUG,
                "base_currency": "USD",
                "timezone": "UTC",
                "fiscal_year_start_month": 1,
                "is_active": True,
            },
        )
    else:
        company.name = DEMO_COMPANY_NAME
        company.base_currency = "USD"
        company.timezone = "UTC"
        company.fiscal_year_start_month = 1
        company.is_active = True
        company.save(update_fields=["name", "base_currency", "timezone", "fiscal_year_start_month", "is_active"])

        ensure_default_roles_for_company(company)
        CompanyMember.objects.update_or_create(
            company=company,
            user=owner,
            defaults={"status": CompanyMemberStatus.ACTIVE},
        )
        assign_owner_role(company, owner)
    return company


def _assign_role(*, company: Company, user: User, role_name: str):
    CompanyMember.objects.update_or_create(
        company=company,
        user=user,
        defaults={"status": CompanyMemberStatus.ACTIVE},
    )
    role = CompanyRole.objects.get(company=company, name=role_name)
    CompanyRoleAssignment.objects.get_or_create(company=company, user=user, role=role)


def _seed_chart_of_accounts(company: Company) -> dict[str, Account]:
    definitions = [
        ("1000", "Cash", AccountType.ASSET, NormalBalance.DEBIT),
        ("1100", "Accounts Receivable", AccountType.ASSET, NormalBalance.DEBIT),
        ("2000", "Accounts Payable", AccountType.LIABILITY, NormalBalance.CREDIT),
        ("3000", "Owner Equity", AccountType.EQUITY, NormalBalance.CREDIT),
        ("4000", "Service Revenue", AccountType.INCOME, NormalBalance.CREDIT),
        ("5000", "Operating Expense", AccountType.EXPENSE, NormalBalance.DEBIT),
    ]

    accounts: dict[str, Account] = {}
    for code, name, account_type, normal_balance in definitions:
        account, _ = Account.objects.update_or_create(
            company=company,
            code=code,
            defaults={
                "name": name,
                "type": account_type,
                "normal_balance": normal_balance,
                "is_active": True,
            },
        )
        accounts[code] = account
    return accounts


def _seed_contacts(company: Company) -> tuple[Contact, Contact]:
    customer, _ = Contact.objects.update_or_create(
        company=company,
        email="customer@demo.local",
        defaults={
            "type": ContactType.CUSTOMER,
            "name": "Demo Customer",
            "phone": "+1-555-1001",
            "address": "100 Demo St",
            "tax_id": "CUST-DEMO-001",
            "is_active": True,
        },
    )
    vendor, _ = Contact.objects.update_or_create(
        company=company,
        email="vendor@demo.local",
        defaults={
            "type": ContactType.VENDOR,
            "name": "Demo Vendor",
            "phone": "+1-555-2001",
            "address": "200 Demo Ave",
            "tax_id": "VEND-DEMO-001",
            "is_active": True,
        },
    )
    return customer, vendor


def _seed_sales(
    *,
    company: Company,
    actor_user: User,
    customer: Contact,
    ar_account: Account,
    revenue_account: Account,
    cash_account: Account,
) -> tuple[Invoice, Receipt | None]:
    today = timezone.now().date()
    invoice, _ = Invoice.objects.get_or_create(
        company=company,
        notes=DEMO_INVOICE_NOTE,
        defaults={
            "customer": customer,
            "issue_date": today - timedelta(days=10),
            "due_date": today + timedelta(days=20),
            "currency_code": "USD",
            "ar_account": ar_account,
        },
    )

    if invoice.status == InvoiceStatus.DRAFT:
        invoice.customer = customer
        invoice.issue_date = today - timedelta(days=10)
        invoice.due_date = today + timedelta(days=20)
        invoice.currency_code = "USD"
        invoice.ar_account = ar_account
        invoice.save(update_fields=["customer", "issue_date", "due_date", "currency_code", "ar_account", "updated_at"])
        replace_invoice_lines(
            invoice=invoice,
            lines=[
                {
                    "line_no": 1,
                    "description": "Bookkeeping service package",
                    "quantity": Decimal("1"),
                    "unit_price": Decimal("1200.00"),
                    "revenue_account": revenue_account,
                }
            ],
        )
        invoice = post_invoice(invoice=invoice, actor_user=actor_user)

    open_amount = (invoice.total or Decimal("0")) - (invoice.amount_paid or Decimal("0"))
    if open_amount <= 0:
        return invoice, None

    receipt, _ = Receipt.objects.get_or_create(
        company=company,
        notes=DEMO_RECEIPT_NOTE,
        defaults={
            "customer": customer,
            "received_date": today - timedelta(days=5),
            "amount": min(open_amount, Decimal("750.00")),
            "currency_code": "USD",
            "deposit_account": cash_account,
        },
    )

    if receipt.status == ReceiptStatus.DRAFT:
        allocation_amount = min(open_amount, Decimal("750.00"))
        if allocation_amount > 0:
            receipt.customer = customer
            receipt.received_date = today - timedelta(days=5)
            receipt.currency_code = "USD"
            receipt.deposit_account = cash_account
            receipt.amount = allocation_amount
            receipt.save(
                update_fields=["customer", "received_date", "currency_code", "deposit_account", "amount", "updated_at"]
            )
            replace_receipt_allocations(
                receipt=receipt,
                allocations=[
                    {
                        "invoice": invoice,
                        "amount": allocation_amount,
                    }
                ],
            )
            receipt = post_receipt(receipt=receipt, actor_user=actor_user)

    return invoice, receipt


def _seed_purchases(
    *,
    company: Company,
    actor_user: User,
    vendor: Contact,
    ap_account: Account,
    expense_account: Account,
    cash_account: Account,
) -> tuple[Bill, VendorPayment | None]:
    today = timezone.now().date()
    bill, _ = Bill.objects.get_or_create(
        company=company,
        notes=DEMO_BILL_NOTE,
        defaults={
            "vendor": vendor,
            "bill_date": today - timedelta(days=9),
            "due_date": today + timedelta(days=15),
            "currency_code": "USD",
            "ap_account": ap_account,
        },
    )

    if bill.status == BillStatus.DRAFT:
        bill.vendor = vendor
        bill.bill_date = today - timedelta(days=9)
        bill.due_date = today + timedelta(days=15)
        bill.currency_code = "USD"
        bill.ap_account = ap_account
        bill.save(update_fields=["vendor", "bill_date", "due_date", "currency_code", "ap_account", "updated_at"])
        replace_bill_lines(
            bill=bill,
            lines=[
                {
                    "line_no": 1,
                    "description": "Software subscription expense",
                    "quantity": Decimal("1"),
                    "unit_cost": Decimal("900.00"),
                    "expense_account": expense_account,
                }
            ],
        )
        bill = post_bill(bill=bill, actor_user=actor_user)

    open_amount = (bill.total or Decimal("0")) - (bill.amount_paid or Decimal("0"))
    if open_amount <= 0:
        return bill, None

    payment, _ = VendorPayment.objects.get_or_create(
        company=company,
        notes=DEMO_VENDOR_PAYMENT_NOTE,
        defaults={
            "vendor": vendor,
            "paid_date": today - timedelta(days=4),
            "amount": min(open_amount, Decimal("400.00")),
            "currency_code": "USD",
            "payment_account": cash_account,
        },
    )

    if payment.status == VendorPaymentStatus.DRAFT:
        allocation_amount = min(open_amount, Decimal("400.00"))
        if allocation_amount > 0:
            payment.vendor = vendor
            payment.paid_date = today - timedelta(days=4)
            payment.currency_code = "USD"
            payment.payment_account = cash_account
            payment.amount = allocation_amount
            payment.save(
                update_fields=["vendor", "paid_date", "currency_code", "payment_account", "amount", "updated_at"]
            )
            replace_vendor_payment_allocations(
                vendor_payment=payment,
                allocations=[
                    {
                        "bill": bill,
                        "amount": allocation_amount,
                    }
                ],
            )
            payment = post_vendor_payment(vendor_payment=payment, actor_user=actor_user)

    return bill, payment


def _seed_banking(
    *,
    company: Company,
    actor_user: User,
    cash_account: Account,
    reference_journal_entry_id,
) -> tuple[BankAccount, BankReconciliation]:
    today = timezone.now().date()
    bank_account, _ = BankAccount.objects.update_or_create(
        company=company,
        name=DEMO_BANK_ACCOUNT_NAME,
        defaults={
            "account_number_last4": "1234",
            "currency_code": "USD",
            "ledger_account": cash_account,
            "is_active": True,
        },
    )

    statement_import = (
        BankStatementImport.objects.filter(
            company=company,
            bank_account=bank_account,
            file_name=DEMO_STATEMENT_FILE_NAME,
        )
        .order_by("created_at")
        .first()
    )
    if statement_import is None:
        statement_import = BankStatementImport.objects.create(
            company=company,
            bank_account=bank_account,
            file_name=DEMO_STATEMENT_FILE_NAME,
            raw_content=(
                "date,description,amount,reference\n"
                f"{today.isoformat()},Customer receipt,750.00,SEED-DEP-001\n"
                f"{today.isoformat()},Bank fee,-20.00,SEED-FEE-001"
            ),
            imported_by_user=actor_user,
        )

    if not statement_import.transactions.exists():
        parse_statement_import(statement_import=statement_import)

    deposit_tx = (
        statement_import.transactions.filter(reference="SEED-DEP-001")
        .order_by("created_at")
        .first()
    )
    reference_journal_entry = None
    if reference_journal_entry_id:
        reference_journal_entry = JournalEntry.objects.filter(
            company=company,
            id=reference_journal_entry_id,
            status=JournalStatus.POSTED,
        ).first()

    if deposit_tx and reference_journal_entry and deposit_tx.status != BankTransactionStatus.RECONCILED:
        if deposit_tx.matched_journal_entry_id != reference_journal_entry.id:
            match_bank_transaction(
                bank_transaction=deposit_tx,
                journal_entry=reference_journal_entry,
            )

    period_start = today.replace(day=1)
    reconciliation = (
        BankReconciliation.objects.filter(
            company=company,
            bank_account=bank_account,
            start_date=period_start,
            end_date=today,
        )
        .order_by("created_at")
        .first()
    )
    if reconciliation is None:
        reconciliation = BankReconciliation.objects.create(
            company=company,
            bank_account=bank_account,
            start_date=period_start,
            end_date=today,
            opening_balance=Decimal("0.0000"),
            closing_balance=Decimal("730.0000"),
        )

    if deposit_tx and reconciliation.status == ReconciliationStatus.DRAFT:
        replace_reconciliation_lines(reconciliation=reconciliation, transactions=[deposit_tx])
        reconciliation = finalize_reconciliation(reconciliation=reconciliation, actor_user=actor_user)

    return bank_account, reconciliation


@transaction.atomic
def seed_demo_company(*, password: str = DEMO_PASSWORD, include_company_data: bool = True) -> dict:
    owner = _upsert_user(
        email="owner@demo.local",
        full_name="Demo Owner",
        password=password,
        is_staff=True,
    )
    company = _ensure_company(owner)

    admin = _upsert_user(email="admin@demo.local", full_name="Demo Admin", password=password)
    accountant = _upsert_user(email="accountant@demo.local", full_name="Demo Accountant", password=password)
    viewer = _upsert_user(email="viewer@demo.local", full_name="Demo Viewer", password=password)

    _assign_role(company=company, user=admin, role_name=ROLE_ADMIN)
    _assign_role(company=company, user=accountant, role_name=ROLE_ACCOUNTANT)
    _assign_role(company=company, user=viewer, role_name=ROLE_VIEWER)
    _assign_role(company=company, user=owner, role_name=ROLE_OWNER)

    summary = {
        "company_slug": company.slug,
        "users": [owner.email, admin.email, accountant.email, viewer.email],
    }
    if not include_company_data:
        summary["with_data"] = False
        return summary

    accounts = _seed_chart_of_accounts(company)
    customer, vendor = _seed_contacts(company)
    invoice, receipt = _seed_sales(
        company=company,
        actor_user=owner,
        customer=customer,
        ar_account=accounts["1100"],
        revenue_account=accounts["4000"],
        cash_account=accounts["1000"],
    )
    bill, vendor_payment = _seed_purchases(
        company=company,
        actor_user=owner,
        vendor=vendor,
        ap_account=accounts["2000"],
        expense_account=accounts["5000"],
        cash_account=accounts["1000"],
    )

    reference_journal_entry_id = None
    if receipt and receipt.journal_entry_id:
        reference_journal_entry_id = receipt.journal_entry_id
    elif invoice.journal_entry_id:
        reference_journal_entry_id = invoice.journal_entry_id

    bank_account, reconciliation = _seed_banking(
        company=company,
        actor_user=owner,
        cash_account=accounts["1000"],
        reference_journal_entry_id=reference_journal_entry_id,
    )

    summary.update(
        {
            "with_data": True,
            "account_count": len(accounts),
            "customer_id": str(customer.id),
            "vendor_id": str(vendor.id),
            "invoice_status": invoice.status,
            "receipt_status": getattr(receipt, "status", None),
            "bill_status": bill.status,
            "vendor_payment_status": getattr(vendor_payment, "status", None),
            "bank_account_id": str(bank_account.id),
            "reconciliation_status": reconciliation.status,
        }
    )
    return summary
