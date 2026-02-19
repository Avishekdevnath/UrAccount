export type AuthTokens = {
  access: string;
  refresh: string;
};

export type UserMe = {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  is_staff: boolean;
  is_superuser: boolean;
};

export type Company = {
  id: string;
  name: string;
  slug: string;
  base_currency: string;
  timezone: string;
  fiscal_year_start_month: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CompanyAccess = {
  company_id: string;
  roles: string[];
  permissions: string[];
};

export type Account = {
  id: string;
  company: string;
  code: string;
  name: string;
  type: "asset" | "liability" | "equity" | "income" | "expense";
  normal_balance: "debit" | "credit";
  parent: string | null;
  is_active: boolean;
  is_system: boolean;
  created_at: string;
  updated_at: string;
};

export type TrialBalanceRow = {
  account__id: string;
  account__code: string;
  account__name: string;
  total_debit: string;
  total_credit: string;
};

export type JournalLine = {
  id: string;
  line_no: number;
  account: string;
  account_code: string;
  account_name: string;
  description: string;
  debit: string;
  credit: string;
};

export type JournalEntry = {
  id: string;
  company: string;
  entry_no: number | null;
  status: "draft" | "posted" | "void";
  entry_date: string;
  description: string;
  reference_type: string;
  reference_id: string | null;
  posted_at: string | null;
  posted_by_user: string | null;
  voided_at: string | null;
  voided_by_user: string | null;
  created_at: string;
  updated_at: string;
  lines: JournalLine[];
};

export type ContactType = "customer" | "vendor" | "both";

export type Contact = {
  id: string;
  company: string;
  type: ContactType;
  name: string;
  email: string;
  phone: string;
  address: string;
  tax_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type InvoiceStatus = "draft" | "posted" | "partially_paid" | "paid" | "void";

export type InvoiceLine = {
  id: string;
  line_no: number;
  description: string;
  quantity: string;
  unit_price: string;
  line_total: string;
  revenue_account: string;
  created_at: string;
  updated_at: string;
};

export type Invoice = {
  id: string;
  company: string;
  invoice_no: number | null;
  status: InvoiceStatus;
  customer: string;
  issue_date: string;
  due_date: string | null;
  currency_code: string;
  subtotal: string;
  tax_total: string;
  total: string;
  amount_paid: string;
  notes: string;
  ar_account: string;
  journal_entry: string | null;
  created_at: string;
  updated_at: string;
  lines: InvoiceLine[];
};

export type ReceiptStatus = "draft" | "posted" | "void";

export type ReceiptAllocation = {
  id: string;
  invoice: string;
  amount: string;
  created_at: string;
};

export type Receipt = {
  id: string;
  company: string;
  receipt_no: number | null;
  status: ReceiptStatus;
  customer: string;
  received_date: string;
  amount: string;
  currency_code: string;
  deposit_account: string;
  journal_entry: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
  allocations: ReceiptAllocation[];
};

export type ARAgingRow = {
  invoice_id: string;
  invoice_no: number | null;
  customer_name: string;
  due_date: string;
  open_amount: string;
  age_days: number;
  bucket: "0-30" | "31-60" | "61-90" | "90+";
};

export type BillStatus = "draft" | "posted" | "partially_paid" | "paid" | "void";

export type BillLine = {
  id: string;
  line_no: number;
  description: string;
  quantity: string;
  unit_cost: string;
  line_total: string;
  expense_account: string;
  created_at: string;
  updated_at: string;
};

export type Bill = {
  id: string;
  company: string;
  bill_no: number | null;
  status: BillStatus;
  vendor: string;
  bill_date: string;
  due_date: string | null;
  currency_code: string;
  subtotal: string;
  tax_total: string;
  total: string;
  amount_paid: string;
  notes: string;
  ap_account: string;
  journal_entry: string | null;
  created_at: string;
  updated_at: string;
  lines: BillLine[];
};

export type VendorPaymentStatus = "draft" | "posted" | "void";

export type VendorPaymentAllocation = {
  id: string;
  bill: string;
  amount: string;
  created_at: string;
};

export type VendorPayment = {
  id: string;
  company: string;
  payment_no: number | null;
  status: VendorPaymentStatus;
  vendor: string;
  paid_date: string;
  amount: string;
  currency_code: string;
  payment_account: string;
  journal_entry: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
  allocations: VendorPaymentAllocation[];
};

export type APAgingRow = {
  bill_id: string;
  bill_no: number | null;
  vendor_name: string;
  due_date: string;
  open_amount: string;
  age_days: number;
  bucket: "0-30" | "31-60" | "61-90" | "90+";
};

export type BankImportStatus = "uploaded" | "parsed" | "failed";
export type BankTransactionStatus = "imported" | "matched" | "reconciled" | "ignored";
export type ReconciliationStatus = "draft" | "finalized";

export type BankAccount = {
  id: string;
  company: string;
  name: string;
  account_number_last4: string;
  currency_code: string;
  ledger_account: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type BankStatementImport = {
  id: string;
  company: string;
  bank_account: string;
  file_name: string;
  status: BankImportStatus;
  raw_content: string;
  error_message: string;
  imported_by_user: string | null;
  created_at: string;
  updated_at: string;
  transactions_created?: number;
};

export type BankTransaction = {
  id: string;
  company: string;
  bank_account: string;
  bank_account_name: string;
  statement_import: string | null;
  txn_date: string;
  description: string;
  reference: string;
  amount: string;
  status: BankTransactionStatus;
  matched_journal_entry: string | null;
  matched_entry_no: number | null;
  created_at: string;
  updated_at: string;
};

export type BankReconciliationLine = {
  id: string;
  bank_transaction_id: string;
};

export type BankReconciliation = {
  id: string;
  company: string;
  bank_account: string;
  start_date: string;
  end_date: string;
  opening_balance: string;
  closing_balance: string;
  status: ReconciliationStatus;
  finalized_at: string | null;
  finalized_by_user: string | null;
  created_at: string;
  updated_at: string;
  lines?: BankReconciliationLine[];
};

export type ProfitLossRow = {
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: "income" | "expense";
  balance: string;
};

export type ProfitLossReport = {
  start_date: string;
  end_date: string;
  income_total: string;
  expense_total: string;
  net_profit: string;
  rows: ProfitLossRow[];
};

export type BalanceSheetRow = {
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: "asset" | "liability" | "equity";
  balance: string;
};

export type BalanceSheetReport = {
  as_of: string;
  asset_total: string;
  liability_total: string;
  equity_total: string;
  liability_plus_equity_total: string;
  rows: BalanceSheetRow[];
};

export type CashFlowReport = {
  start_date: string;
  end_date: string;
  cash_inflow: string;
  cash_outflow: string;
  net_cash_movement: string;
};

export type ReportTrialBalanceRow = {
  account_id: string;
  account_code: string;
  account_name: string;
  total_debit: string;
  total_credit: string;
};

export type ReportTrialBalance = {
  start_date: string;
  end_date: string;
  rows: ReportTrialBalanceRow[];
};

export type GeneralLedgerRow = {
  line_id: string;
  entry_id: string;
  entry_no: number | null;
  entry_date: string;
  account_id: string;
  account_code: string;
  account_name: string;
  description: string;
  debit: string;
  credit: string;
};

export type GeneralLedgerReport = {
  start_date: string;
  end_date: string;
  limit: number;
  rows: GeneralLedgerRow[];
};
