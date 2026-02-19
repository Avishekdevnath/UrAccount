from collections import defaultdict
from decimal import Decimal

from apps.accounting.models import AccountType
from apps.banking.models import BankAccount
from apps.journals.models import JournalLine, JournalStatus


def _posted_lines(company, *, start_date=None, end_date=None):
    queryset = JournalLine.objects.filter(
        company=company,
        journal_entry__status=JournalStatus.POSTED,
    ).select_related("account", "journal_entry")
    if start_date:
        queryset = queryset.filter(journal_entry__entry_date__gte=start_date)
    if end_date:
        queryset = queryset.filter(journal_entry__entry_date__lte=end_date)
    return queryset


def build_profit_and_loss(*, company, start_date, end_date):
    lines = _posted_lines(company, start_date=start_date, end_date=end_date)
    by_account = defaultdict(lambda: {"code": "", "name": "", "type": "", "debit": Decimal("0"), "credit": Decimal("0")})
    for line in lines:
        if line.account.type not in {AccountType.INCOME, AccountType.EXPENSE}:
            continue
        item = by_account[str(line.account_id)]
        item["code"] = line.account.code
        item["name"] = line.account.name
        item["type"] = line.account.type
        item["debit"] += line.debit
        item["credit"] += line.credit

    rows = []
    income_total = Decimal("0")
    expense_total = Decimal("0")
    for account_id, item in by_account.items():
        if item["type"] == AccountType.INCOME:
            balance = item["credit"] - item["debit"]
            income_total += balance
        else:
            balance = item["debit"] - item["credit"]
            expense_total += balance
        rows.append(
            {
                "account_id": account_id,
                "account_code": item["code"],
                "account_name": item["name"],
                "account_type": item["type"],
                "balance": str(balance.quantize(Decimal("0.0001"))),
            }
        )

    rows.sort(key=lambda row: row["account_code"])
    return {
        "start_date": start_date,
        "end_date": end_date,
        "income_total": str(income_total.quantize(Decimal("0.0001"))),
        "expense_total": str(expense_total.quantize(Decimal("0.0001"))),
        "net_profit": str((income_total - expense_total).quantize(Decimal("0.0001"))),
        "rows": rows,
    }


def build_balance_sheet(*, company, as_of):
    lines = _posted_lines(company, end_date=as_of)
    by_account = defaultdict(lambda: {"code": "", "name": "", "type": "", "debit": Decimal("0"), "credit": Decimal("0")})
    for line in lines:
        item = by_account[str(line.account_id)]
        item["code"] = line.account.code
        item["name"] = line.account.name
        item["type"] = line.account.type
        item["debit"] += line.debit
        item["credit"] += line.credit

    rows = []
    asset_total = Decimal("0")
    liability_total = Decimal("0")
    equity_total = Decimal("0")

    for account_id, item in by_account.items():
        account_type = item["type"]
        if account_type == AccountType.ASSET:
            balance = item["debit"] - item["credit"]
            asset_total += balance
        elif account_type == AccountType.LIABILITY:
            balance = item["credit"] - item["debit"]
            liability_total += balance
        elif account_type == AccountType.EQUITY:
            balance = item["credit"] - item["debit"]
            equity_total += balance
        else:
            continue

        rows.append(
            {
                "account_id": account_id,
                "account_code": item["code"],
                "account_name": item["name"],
                "account_type": account_type,
                "balance": str(balance.quantize(Decimal("0.0001"))),
            }
        )

    rows.sort(key=lambda row: row["account_code"])
    return {
        "as_of": as_of,
        "asset_total": str(asset_total.quantize(Decimal("0.0001"))),
        "liability_total": str(liability_total.quantize(Decimal("0.0001"))),
        "equity_total": str(equity_total.quantize(Decimal("0.0001"))),
        "liability_plus_equity_total": str((liability_total + equity_total).quantize(Decimal("0.0001"))),
        "rows": rows,
    }


def build_cash_flow(*, company, start_date, end_date):
    lines = _posted_lines(company, start_date=start_date, end_date=end_date)

    configured_cash_accounts = set(BankAccount.objects.filter(company=company).values_list("ledger_account_id", flat=True))
    inflow = Decimal("0")
    outflow = Decimal("0")
    for line in lines:
        is_cash_account = line.account_id in configured_cash_accounts
        if not is_cash_account and line.account.type == AccountType.ASSET:
            is_cash_account = "cash" in line.account.name.lower() or "bank" in line.account.name.lower()
        if not is_cash_account:
            continue
        delta = line.debit - line.credit
        if delta >= 0:
            inflow += delta
        else:
            outflow += -delta

    net_cash = inflow - outflow
    return {
        "start_date": start_date,
        "end_date": end_date,
        "cash_inflow": str(inflow.quantize(Decimal("0.0001"))),
        "cash_outflow": str(outflow.quantize(Decimal("0.0001"))),
        "net_cash_movement": str(net_cash.quantize(Decimal("0.0001"))),
    }


def build_trial_balance(*, company, start_date, end_date):
    lines = _posted_lines(company, start_date=start_date, end_date=end_date)
    by_account = defaultdict(lambda: {"code": "", "name": "", "debit": Decimal("0"), "credit": Decimal("0")})
    for line in lines:
        item = by_account[str(line.account_id)]
        item["code"] = line.account.code
        item["name"] = line.account.name
        item["debit"] += line.debit
        item["credit"] += line.credit

    rows = []
    for account_id, item in by_account.items():
        rows.append(
            {
                "account_id": account_id,
                "account_code": item["code"],
                "account_name": item["name"],
                "total_debit": str(item["debit"].quantize(Decimal("0.0001"))),
                "total_credit": str(item["credit"].quantize(Decimal("0.0001"))),
            }
        )
    rows.sort(key=lambda row: row["account_code"])
    return {"start_date": start_date, "end_date": end_date, "rows": rows}


def build_general_ledger(*, company, start_date, end_date, account_id=None, limit=200):
    lines = _posted_lines(company, start_date=start_date, end_date=end_date)
    if account_id:
        lines = lines.filter(account_id=account_id)
    lines = lines.order_by("-journal_entry__entry_date", "-created_at")[:limit]

    rows = [
        {
            "line_id": str(line.id),
            "entry_id": str(line.journal_entry_id),
            "entry_no": line.journal_entry.entry_no,
            "entry_date": line.journal_entry.entry_date,
            "account_id": str(line.account_id),
            "account_code": line.account.code,
            "account_name": line.account.name,
            "description": line.description,
            "debit": str(line.debit),
            "credit": str(line.credit),
        }
        for line in lines
    ]
    return {
        "start_date": start_date,
        "end_date": end_date,
        "limit": limit,
        "rows": rows,
    }
