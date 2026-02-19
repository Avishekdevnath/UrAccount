import csv
import io

from django.http import HttpResponse


def _csv_response(*, filename: str, headers: list[str], rows: list[list[str]]) -> HttpResponse:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(headers)
    writer.writerows(rows)

    response = HttpResponse(buffer.getvalue(), content_type="text/csv")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


def profit_loss_csv_response(payload):
    rows = [
        [row["account_code"], row["account_name"], row["account_type"], row["balance"]]
        for row in payload["rows"]
    ]
    rows.extend(
        [
            [],
            ["", "", "income_total", payload["income_total"]],
            ["", "", "expense_total", payload["expense_total"]],
            ["", "", "net_profit", payload["net_profit"]],
        ]
    )
    return _csv_response(
        filename=f"profit_loss_{payload['start_date']}_{payload['end_date']}.csv",
        headers=["account_code", "account_name", "account_type", "balance"],
        rows=rows,
    )


def balance_sheet_csv_response(payload):
    rows = [
        [row["account_code"], row["account_name"], row["account_type"], row["balance"]]
        for row in payload["rows"]
    ]
    rows.extend(
        [
            [],
            ["", "", "asset_total", payload["asset_total"]],
            ["", "", "liability_total", payload["liability_total"]],
            ["", "", "equity_total", payload["equity_total"]],
            ["", "", "liability_plus_equity_total", payload["liability_plus_equity_total"]],
        ]
    )
    return _csv_response(
        filename=f"balance_sheet_{payload['as_of']}.csv",
        headers=["account_code", "account_name", "account_type", "balance"],
        rows=rows,
    )


def cash_flow_csv_response(payload):
    rows = [
        ["start_date", str(payload["start_date"])],
        ["end_date", str(payload["end_date"])],
        ["cash_inflow", payload["cash_inflow"]],
        ["cash_outflow", payload["cash_outflow"]],
        ["net_cash_movement", payload["net_cash_movement"]],
    ]
    return _csv_response(
        filename=f"cash_flow_{payload['start_date']}_{payload['end_date']}.csv",
        headers=["metric", "value"],
        rows=rows,
    )


def trial_balance_csv_response(payload):
    rows = [
        [row["account_code"], row["account_name"], row["total_debit"], row["total_credit"]]
        for row in payload["rows"]
    ]
    return _csv_response(
        filename=f"trial_balance_{payload['start_date']}_{payload['end_date']}.csv",
        headers=["account_code", "account_name", "total_debit", "total_credit"],
        rows=rows,
    )


def general_ledger_csv_response(payload):
    rows = [
        [
            str(row["entry_date"]),
            str(row["entry_no"] or ""),
            row["account_code"],
            row["account_name"],
            row["description"],
            row["debit"],
            row["credit"],
        ]
        for row in payload["rows"]
    ]
    return _csv_response(
        filename=f"general_ledger_{payload['start_date']}_{payload['end_date']}.csv",
        headers=["entry_date", "entry_no", "account_code", "account_name", "description", "debit", "credit"],
        rows=rows,
    )
