import type {
  BalanceSheetReport,
  CashFlowReport,
  GeneralLedgerReport,
  ProfitLossReport,
  ReportTrialBalance,
} from "@/lib/api-types";
import {
  buildPrintPageHtml,
  formatDate,
  formatNumber,
  printHtml,
  renderKeyValueList,
  renderMetricGrid,
  renderTable,
} from "@/lib/print/core";

type ProfitLossPrintParams = {
  companyName: string;
  report: ProfitLossReport;
};

type BalanceSheetPrintParams = {
  companyName: string;
  report: BalanceSheetReport;
};

type CashFlowPrintParams = {
  companyName: string;
  report: CashFlowReport;
};

type TrialBalancePrintParams = {
  companyName: string;
  report: ReportTrialBalance;
};

type GeneralLedgerPrintParams = {
  companyName: string;
  report: GeneralLedgerReport;
};

function formatDateRange(startDate: string, endDate: string): string {
  return `${formatDate(startDate)} - ${formatDate(endDate)}`;
}

export function printProfitLossReport({ companyName, report }: ProfitLossPrintParams): boolean {
  const incomeRows = report.rows
    .filter((row) => row.account_type === "income")
    .map((row) => [row.account_code, row.account_name, formatNumber(row.balance)]);

  const expenseRows = report.rows
    .filter((row) => row.account_type === "expense")
    .map((row) => [row.account_code, row.account_name, formatNumber(row.balance)]);

  const netProfit = Number.parseFloat(report.net_profit);

  const html = buildPrintPageHtml({
    title: "Profit & Loss",
    heading: "PROFIT & LOSS",
    subtitle: companyName,
    meta: [{ label: "Period", value: formatDateRange(report.start_date, report.end_date) }],
    sectionsHtml: [
      renderMetricGrid([
        { label: "Total Income", value: formatNumber(report.income_total), tone: "positive" },
        { label: "Total Expense", value: formatNumber(report.expense_total), tone: "negative" },
        {
          label: Number.isNaN(netProfit) || netProfit >= 0 ? "Net Profit" : "Net Loss",
          value: formatNumber(report.net_profit),
          tone: Number.isNaN(netProfit) || netProfit >= 0 ? "positive" : "negative",
        },
      ]),
      renderTable({
        title: "Income",
        columns: [
          { label: "Code" },
          { label: "Account" },
          { label: "Balance", align: "right" },
        ],
        rows: incomeRows,
        emptyText: "No income rows",
      }),
      renderTable({
        title: "Expenses",
        columns: [
          { label: "Code" },
          { label: "Account" },
          { label: "Balance", align: "right" },
        ],
        rows: expenseRows,
        emptyText: "No expense rows",
      }),
    ].join(""),
    footerText: "Generated from URAccount profit & loss report.",
  });

  return printHtml(html);
}

export function printBalanceSheetReport({ companyName, report }: BalanceSheetPrintParams): boolean {
  const assetRows = report.rows
    .filter((row) => row.account_type === "asset")
    .map((row) => [row.account_code, row.account_name, formatNumber(row.balance)]);
  const liabilityRows = report.rows
    .filter((row) => row.account_type === "liability")
    .map((row) => [row.account_code, row.account_name, formatNumber(row.balance)]);
  const equityRows = report.rows
    .filter((row) => row.account_type === "equity")
    .map((row) => [row.account_code, row.account_name, formatNumber(row.balance)]);

  const html = buildPrintPageHtml({
    title: "Balance Sheet",
    heading: "BALANCE SHEET",
    subtitle: companyName,
    meta: [{ label: "As Of", value: formatDate(report.as_of) }],
    sectionsHtml: [
      renderMetricGrid([
        { label: "Assets", value: formatNumber(report.asset_total) },
        { label: "Liabilities", value: formatNumber(report.liability_total) },
        { label: "Equity", value: formatNumber(report.equity_total) },
      ]),
      renderTable({
        title: "Assets",
        columns: [
          { label: "Code" },
          { label: "Account" },
          { label: "Balance", align: "right" },
        ],
        rows: assetRows,
        emptyText: "No asset rows",
      }),
      renderTable({
        title: "Liabilities",
        columns: [
          { label: "Code" },
          { label: "Account" },
          { label: "Balance", align: "right" },
        ],
        rows: liabilityRows,
        emptyText: "No liability rows",
      }),
      renderTable({
        title: "Equity",
        columns: [
          { label: "Code" },
          { label: "Account" },
          { label: "Balance", align: "right" },
        ],
        rows: equityRows,
        emptyText: "No equity rows",
      }),
      renderKeyValueList(
        [
          { label: "Total Assets", value: formatNumber(report.asset_total) },
          { label: "Total Liabilities", value: formatNumber(report.liability_total) },
          { label: "Total Equity", value: formatNumber(report.equity_total) },
          { label: "Liabilities + Equity", value: formatNumber(report.liability_plus_equity_total) },
        ],
        true
      ),
    ].join(""),
    footerText: "Generated from URAccount balance sheet report.",
  });

  return printHtml(html);
}

export function printCashFlowReport({ companyName, report }: CashFlowPrintParams): boolean {
  const net = Number.parseFloat(report.net_cash_movement);

  const html = buildPrintPageHtml({
    title: "Cash Flow",
    heading: "CASH FLOW",
    subtitle: companyName,
    meta: [{ label: "Period", value: formatDateRange(report.start_date, report.end_date) }],
    sectionsHtml: renderMetricGrid([
      { label: "Cash Inflow", value: formatNumber(report.cash_inflow), tone: "positive" },
      { label: "Cash Outflow", value: formatNumber(report.cash_outflow), tone: "negative" },
      {
        label: "Net Movement",
        value: formatNumber(report.net_cash_movement),
        tone: Number.isNaN(net) || net >= 0 ? "positive" : "negative",
      },
    ]),
    footerText: "Generated from URAccount cash flow report.",
  });

  return printHtml(html);
}

export function printTrialBalanceReport({ companyName, report }: TrialBalancePrintParams): boolean {
  const rows = report.rows.map((row) => [
    row.account_code,
    row.account_name,
    formatNumber(row.total_debit),
    formatNumber(row.total_credit),
  ]);

  const totalDebit = report.rows.reduce((sum, row) => sum + Number.parseFloat(row.total_debit || "0"), 0);
  const totalCredit = report.rows.reduce((sum, row) => sum + Number.parseFloat(row.total_credit || "0"), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  const html = buildPrintPageHtml({
    title: "Trial Balance",
    heading: "TRIAL BALANCE",
    subtitle: companyName,
    meta: [
      { label: "Period", value: formatDateRange(report.start_date, report.end_date) },
      { label: "Status", value: isBalanced ? "Balanced" : "Out of Balance" },
    ],
    sectionsHtml: [
      renderTable({
        columns: [
          { label: "Code" },
          { label: "Account" },
          { label: "Debit", align: "right" },
          { label: "Credit", align: "right" },
        ],
        rows,
        emptyText: "No trial balance rows",
      }),
      renderKeyValueList(
        [
          { label: "Total Debit", value: formatNumber(totalDebit) },
          { label: "Total Credit", value: formatNumber(totalCredit) },
        ],
        true
      ),
    ].join(""),
    footerText: "Generated from URAccount trial balance report.",
  });

  return printHtml(html);
}

export function printGeneralLedgerReport({ companyName, report }: GeneralLedgerPrintParams): boolean {
  const rows = report.rows.map((row) => [
    row.entry_no ? String(row.entry_no) : "-",
    formatDate(row.entry_date),
    `${row.account_code} - ${row.account_name}`,
    row.description || "-",
    formatNumber(row.debit),
    formatNumber(row.credit),
  ]);

  const totalDebit = report.rows.reduce((sum, row) => sum + Number.parseFloat(row.debit || "0"), 0);
  const totalCredit = report.rows.reduce((sum, row) => sum + Number.parseFloat(row.credit || "0"), 0);

  const html = buildPrintPageHtml({
    title: "General Ledger",
    heading: "GENERAL LEDGER",
    subtitle: companyName,
    meta: [
      { label: "Period", value: formatDateRange(report.start_date, report.end_date) },
      { label: "Row Limit", value: String(report.limit) },
    ],
    sectionsHtml: [
      renderTable({
        columns: [
          { label: "Entry #" },
          { label: "Date" },
          { label: "Account" },
          { label: "Description" },
          { label: "Debit", align: "right" },
          { label: "Credit", align: "right" },
        ],
        rows,
        emptyText: "No ledger entries",
      }),
      renderKeyValueList(
        [
          { label: "Total Debit", value: formatNumber(totalDebit) },
          { label: "Total Credit", value: formatNumber(totalCredit) },
        ],
        true
      ),
    ].join(""),
    footerText: "Generated from URAccount general ledger report.",
  });

  return printHtml(html);
}

