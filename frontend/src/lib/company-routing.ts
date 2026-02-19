import type { Company } from "@/lib/api-types";

export function getCompanyDashboardPath(companySlug: string) {
  return `/app/c/${companySlug}/dashboard`;
}

export function getCompanyChartOfAccountsPath(companySlug: string) {
  return `/app/c/${companySlug}/accounting/chart-of-accounts`;
}

export function getCompanyJournalsPath(companySlug: string) {
  return `/app/c/${companySlug}/accounting/journals`;
}

export function getCompanyTrialBalancePath(companySlug: string) {
  return `/app/c/${companySlug}/accounting/trial-balance`;
}

export function getCompanyCustomersPath(companySlug: string) {
  return `/app/c/${companySlug}/sales/customers`;
}

export function getCompanyInvoicesPath(companySlug: string) {
  return `/app/c/${companySlug}/sales/invoices`;
}

export function getCompanyInvoiceDetailPath(companySlug: string, invoiceId: string) {
  return `/app/c/${companySlug}/sales/invoices/${invoiceId}`;
}

export function getCompanyReceiptsPath(companySlug: string) {
  return `/app/c/${companySlug}/sales/receipts`;
}

export function getCompanyReceiptDetailPath(companySlug: string, receiptId: string) {
  return `/app/c/${companySlug}/sales/receipts/${receiptId}`;
}

export function getCompanyARAgingPath(companySlug: string) {
  return `/app/c/${companySlug}/sales/ar-aging`;
}

export function getCompanyVendorsPath(companySlug: string) {
  return `/app/c/${companySlug}/purchases/vendors`;
}

export function getCompanyBillsPath(companySlug: string) {
  return `/app/c/${companySlug}/purchases/bills`;
}

export function getCompanyBillDetailPath(companySlug: string, billId: string) {
  return `/app/c/${companySlug}/purchases/bills/${billId}`;
}

export function getCompanyVendorPaymentsPath(companySlug: string) {
  return `/app/c/${companySlug}/purchases/vendor-payments`;
}

export function getCompanyVendorPaymentDetailPath(companySlug: string, vendorPaymentId: string) {
  return `/app/c/${companySlug}/purchases/vendor-payments/${vendorPaymentId}`;
}

export function getCompanyAPAgingPath(companySlug: string) {
  return `/app/c/${companySlug}/purchases/ap-aging`;
}

export function getCompanyBankAccountsPath(companySlug: string) {
  return `/app/c/${companySlug}/banking/accounts`;
}

export function getCompanyBankImportsPath(companySlug: string) {
  return `/app/c/${companySlug}/banking/imports`;
}

export function getCompanyBankTransactionsPath(companySlug: string) {
  return `/app/c/${companySlug}/banking/transactions`;
}

export function getCompanyReconciliationsPath(companySlug: string) {
  return `/app/c/${companySlug}/banking/reconciliation`;
}

export function getCompanyReconciliationDetailPath(companySlug: string, reconciliationId: string) {
  return `/app/c/${companySlug}/banking/reconciliation/${reconciliationId}`;
}

export function getCompanyProfitLossPath(companySlug: string) {
  return `/app/c/${companySlug}/reports/profit-loss`;
}

export function getCompanyBalanceSheetPath(companySlug: string) {
  return `/app/c/${companySlug}/reports/balance-sheet`;
}

export function getCompanyCashFlowPath(companySlug: string) {
  return `/app/c/${companySlug}/reports/cash-flow`;
}

export function getCompanyReportTrialBalancePath(companySlug: string) {
  return `/app/c/${companySlug}/reports/trial-balance`;
}

export function getCompanyGeneralLedgerPath(companySlug: string) {
  return `/app/c/${companySlug}/reports/general-ledger`;
}

export function getFirstCompanyDashboardPath(companies: Company[]) {
  const first = companies[0];
  if (!first) {
    return null;
  }
  return getCompanyDashboardPath(first.slug);
}
