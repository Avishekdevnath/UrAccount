import { clearTokens, getAccessToken, getRefreshToken, setTokens } from "@/lib/auth-storage";
import type {
  Account,
  APAgingRow,
  ARAgingRow,
  AuthTokens,
  BalanceSheetReport,
  BankAccount,
  BankReconciliation,
  BankStatementImport,
  BankTransaction,
  Bill,
  CashFlowReport,
  Company,
  CompanyAccess,
  CompanyMember,
  Contact,
  ContactType,
  GeneralLedgerReport,
  Invoice,
  JournalEntry,
  ProfitLossReport,
  ReportTrialBalance,
  Receipt,
  TrialBalanceRow,
  UserMe,
  VendorPayment,
} from "@/lib/api-types";
import { API_BASE_URL } from "@/lib/config";

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: Record<string, unknown>;
  requiresAuth?: boolean;
  headers?: HeadersInit;
};

type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

class ApiError extends Error {
  status: number;
  payload: unknown;
  requestId: string | null;

  constructor(message: string, status: number, payload: unknown, requestId: string | null = null) {
    super(message);
    this.status = status;
    this.payload = payload;
    this.requestId = requestId;
  }
}

async function parseResponse(response: Response) {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function refreshAccessToken() {
  const refresh = getRefreshToken();
  if (!refresh) {
    return null;
  }

  const response = await fetch(`${API_BASE_URL}/auth/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });

  if (!response.ok) {
    clearTokens();
    return null;
  }

  const payload = (await parseResponse(response)) as { access?: string };
  if (!payload?.access) {
    clearTokens();
    return null;
  }

  setTokens(payload.access, refresh);
  return payload.access;
}

async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, requiresAuth = true, headers: customHeaders } = options;

  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (customHeaders) {
    Object.assign(headers, customHeaders);
  }
  if (requiresAuth) {
    const access = getAccessToken();
    if (access) {
      headers.Authorization = `Bearer ${access}`;
    }
  }

  let response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (requiresAuth && response.status === 401) {
    const newAccess = await refreshAccessToken();
    if (newAccess) {
      headers.Authorization = `Bearer ${newAccess}`;
      response = await fetch(`${API_BASE_URL}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
    }
  }

  const payload = await parseResponse(response);
  if (!response.ok) {
    const requestId = response.headers.get("X-Request-ID") ?? response.headers.get("x-request-id");
    throw new ApiError("API request failed", response.status, payload, requestId);
  }
  return payload as T;
}

function withQuery(path: string, params: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      query.set(key, value);
    }
  }
  const queryString = query.toString();
  if (!queryString) {
    return path;
  }
  return `${path}?${queryString}`;
}

function normalizeListResponse<T>(payload: T[] | PaginatedResponse<T>) {
  return Array.isArray(payload) ? payload : payload.results;
}

export async function login(email: string, password: string) {
  return apiRequest<AuthTokens>("/auth/login/", {
    method: "POST",
    body: { email, password },
    requiresAuth: false,
  });
}

export async function fetchMe() {
  return apiRequest<UserMe>("/auth/me/");
}

export async function fetchCompanies() {
  const payload = await apiRequest<Company[] | PaginatedResponse<Company>>("/companies/");
  return normalizeListResponse(payload);
}

export async function fetchMyCompanyAccess(companyId: string) {
  return apiRequest<CompanyAccess>(`/rbac/companies/${companyId}/me/`);
}

export async function fetchCompanyMembers(companyId: string) {
  const payload = await apiRequest<CompanyMember[] | PaginatedResponse<CompanyMember>>(
    `/companies/${companyId}/members/`
  );
  return normalizeListResponse(payload);
}

export async function createCompanyMemberUser(
  companyId: string,
  payload: {
    email: string;
    full_name: string;
    password: string;
    role?: "Admin" | "Accountant" | "Viewer";
  }
) {
  return apiRequest<CompanyMember>(`/companies/${companyId}/members/create-user/`, {
    method: "POST",
    body: payload as Record<string, unknown>,
  });
}

export async function resetCompanyMemberPassword(companyId: string, userId: string, newPassword: string) {
  return apiRequest<{ detail: string }>(`/companies/${companyId}/members/${userId}/reset-password/`, {
    method: "POST",
    body: { new_password: newPassword },
  });
}

export async function updateCompanyMemberStatus(
  companyId: string,
  userId: string,
  statusValue: "active" | "invited" | "disabled"
) {
  return apiRequest<CompanyMember>(`/companies/${companyId}/members/${userId}/`, {
    method: "PATCH",
    body: { status: statusValue },
  });
}

export async function replaceCompanyMemberRoles(companyId: string, userId: string, roles: string[]) {
  return apiRequest<{ company_id: string; user_id: string; roles: string[] }>(
    `/companies/${companyId}/members/${userId}/roles/`,
    {
      method: "PATCH",
      body: { roles },
    }
  );
}

export async function removeCompanyMember(companyId: string, userId: string) {
  return apiRequest<void>(`/companies/${companyId}/members/${userId}/`, {
    method: "DELETE",
    body: {},
  });
}

export async function fetchAccounts(companyId: string) {
  const payload = await apiRequest<Account[] | PaginatedResponse<Account>>(
    `/accounting/companies/${companyId}/accounts/`
  );
  return normalizeListResponse(payload);
}

export async function createAccount(
  companyId: string,
  payload: {
    code: string;
    name: string;
    type: Account["type"];
    normal_balance: Account["normal_balance"];
    is_active?: boolean;
  }
) {
  return apiRequest<Account>(`/accounting/companies/${companyId}/accounts/`, {
    method: "POST",
    body: payload,
  });
}

export async function fetchJournals(companyId: string) {
  const payload = await apiRequest<JournalEntry[] | PaginatedResponse<JournalEntry>>(
    `/journals/companies/${companyId}/journals/`
  );
  return normalizeListResponse(payload);
}

export async function createJournal(companyId: string, payload: { entry_date: string; description?: string }) {
  return apiRequest<JournalEntry>(`/journals/companies/${companyId}/journals/`, {
    method: "POST",
    body: payload,
  });
}

export async function replaceJournalLines(
  companyId: string,
  journalId: string,
  lines: Array<{ account_id: string; debit: string; credit: string; description?: string }>
) {
  return apiRequest<JournalEntry>(`/journals/companies/${companyId}/journals/${journalId}/lines/`, {
    method: "PUT",
    body: { lines },
  });
}

export async function postJournal(companyId: string, journalId: string) {
  return apiRequest<JournalEntry>(`/journals/companies/${companyId}/journals/${journalId}/post/`, {
    method: "POST",
    body: {},
  });
}

export async function voidJournal(companyId: string, journalId: string) {
  return apiRequest<{ voided_id: string; reversal_id: string }>(
    `/journals/companies/${companyId}/journals/${journalId}/void/`,
    {
      method: "POST",
      body: {},
    }
  );
}

export async function fetchTrialBalance(companyId: string) {
  const payload = await apiRequest<TrialBalanceRow[] | PaginatedResponse<TrialBalanceRow>>(
    `/journals/companies/${companyId}/ledger/trial-balance/`
  );
  return normalizeListResponse(payload);
}

export async function fetchContacts(
  companyId: string,
  options: {
    type?: ContactType;
    search?: string;
  } = {}
) {
  const payload = await apiRequest<Contact[] | PaginatedResponse<Contact>>(
    withQuery(`/contacts/companies/${companyId}/contacts/`, {
      type: options.type,
      search: options.search,
    })
  );
  return normalizeListResponse(payload);
}

export async function createContact(
  companyId: string,
  payload: {
    type: ContactType;
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    tax_id?: string;
    is_active?: boolean;
  }
) {
  return apiRequest<Contact>(`/contacts/companies/${companyId}/contacts/`, {
    method: "POST",
    body: payload,
  });
}

export async function deleteContact(companyId: string, contactId: string) {
  return apiRequest<null>(`/contacts/companies/${companyId}/contacts/${contactId}/`, {
    method: "DELETE",
  });
}

export async function fetchInvoices(companyId: string, status?: string) {
  const payload = await apiRequest<Invoice[] | PaginatedResponse<Invoice>>(
    withQuery(`/sales/companies/${companyId}/invoices/`, { status })
  );
  return normalizeListResponse(payload);
}

export async function fetchInvoice(companyId: string, invoiceId: string) {
  return apiRequest<Invoice>(`/sales/companies/${companyId}/invoices/${invoiceId}/`);
}

export async function createInvoice(
  companyId: string,
  payload: {
    customer: string;
    issue_date: string;
    due_date?: string;
    currency_code?: string;
    notes?: string;
    ar_account: string;
  }
) {
  return apiRequest<Invoice>(`/sales/companies/${companyId}/invoices/`, {
    method: "POST",
    body: payload,
  });
}

export async function updateInvoice(
  companyId: string,
  invoiceId: string,
  payload: {
    customer: string;
    issue_date: string;
    due_date?: string;
    currency_code?: string;
    notes?: string;
    ar_account: string;
  }
) {
  return apiRequest<Invoice>(`/sales/companies/${companyId}/invoices/${invoiceId}/`, {
    method: "PUT",
    body: payload,
  });
}

export async function replaceInvoiceLines(
  companyId: string,
  invoiceId: string,
  lines: Array<{
    line_no?: number;
    description: string;
    quantity: string;
    unit_price: string;
    revenue_account_id: string;
  }>
) {
  return apiRequest<Invoice>(`/sales/companies/${companyId}/invoices/${invoiceId}/lines/`, {
    method: "PUT",
    body: { lines },
  });
}

export async function postInvoice(companyId: string, invoiceId: string) {
  return apiRequest<Invoice>(`/sales/companies/${companyId}/invoices/${invoiceId}/post/`, {
    method: "POST",
    body: {},
  });
}

export async function voidInvoice(companyId: string, invoiceId: string) {
  return apiRequest<Invoice>(`/sales/companies/${companyId}/invoices/${invoiceId}/void/`, {
    method: "POST",
    body: {},
  });
}

export async function fetchReceipts(companyId: string) {
  const payload = await apiRequest<Receipt[] | PaginatedResponse<Receipt>>(`/sales/companies/${companyId}/receipts/`);
  return normalizeListResponse(payload);
}

export async function fetchReceipt(companyId: string, receiptId: string) {
  return apiRequest<Receipt>(`/sales/companies/${companyId}/receipts/${receiptId}/`);
}

export async function createReceipt(
  companyId: string,
  payload: {
    customer: string;
    received_date: string;
    amount: string;
    currency_code?: string;
    deposit_account: string;
    notes?: string;
  },
  idempotencyKey: string
) {
  return apiRequest<Receipt>(`/sales/companies/${companyId}/receipts/`, {
    method: "POST",
    body: payload,
    headers: { "Idempotency-Key": idempotencyKey },
  });
}

export async function updateReceipt(
  companyId: string,
  receiptId: string,
  payload: {
    customer: string;
    received_date: string;
    amount: string;
    currency_code?: string;
    deposit_account: string;
    notes?: string;
  }
) {
  return apiRequest<Receipt>(`/sales/companies/${companyId}/receipts/${receiptId}/`, {
    method: "PUT",
    body: payload,
  });
}

export async function replaceReceiptAllocations(
  companyId: string,
  receiptId: string,
  allocations: Array<{ invoice_id: string; amount: string }>
) {
  return apiRequest<Receipt>(`/sales/companies/${companyId}/receipts/${receiptId}/allocations/`, {
    method: "PUT",
    body: { allocations },
  });
}

export async function postReceipt(companyId: string, receiptId: string, idempotencyKey: string) {
  return apiRequest<Receipt>(`/sales/companies/${companyId}/receipts/${receiptId}/post/`, {
    method: "POST",
    body: {},
    headers: { "Idempotency-Key": idempotencyKey },
  });
}

export async function voidReceipt(companyId: string, receiptId: string) {
  return apiRequest<Receipt>(`/sales/companies/${companyId}/receipts/${receiptId}/void/`, {
    method: "POST",
    body: {},
  });
}

export async function fetchARAging(companyId: string, asOf?: string) {
  return apiRequest<ARAgingRow[]>(withQuery(`/sales/companies/${companyId}/reports/ar-aging/`, { as_of: asOf }));
}

export async function fetchBills(companyId: string, status?: string) {
  const payload = await apiRequest<Bill[] | PaginatedResponse<Bill>>(
    withQuery(`/purchases/companies/${companyId}/bills/`, { status })
  );
  return normalizeListResponse(payload);
}

export async function fetchBill(companyId: string, billId: string) {
  return apiRequest<Bill>(`/purchases/companies/${companyId}/bills/${billId}/`);
}

export async function createBill(
  companyId: string,
  payload: {
    vendor: string;
    bill_date: string;
    due_date?: string;
    currency_code?: string;
    notes?: string;
    ap_account: string;
  }
) {
  return apiRequest<Bill>(`/purchases/companies/${companyId}/bills/`, {
    method: "POST",
    body: payload,
  });
}

export async function updateBill(
  companyId: string,
  billId: string,
  payload: {
    vendor: string;
    bill_date: string;
    due_date?: string;
    currency_code?: string;
    notes?: string;
    ap_account: string;
  }
) {
  return apiRequest<Bill>(`/purchases/companies/${companyId}/bills/${billId}/`, {
    method: "PUT",
    body: payload,
  });
}

export async function replaceBillLines(
  companyId: string,
  billId: string,
  lines: Array<{
    line_no?: number;
    description: string;
    quantity: string;
    unit_cost: string;
    expense_account_id: string;
  }>
) {
  return apiRequest<Bill>(`/purchases/companies/${companyId}/bills/${billId}/lines/`, {
    method: "PUT",
    body: { lines },
  });
}

export async function postBill(companyId: string, billId: string) {
  return apiRequest<Bill>(`/purchases/companies/${companyId}/bills/${billId}/post/`, {
    method: "POST",
    body: {},
  });
}

export async function voidBill(companyId: string, billId: string) {
  return apiRequest<Bill>(`/purchases/companies/${companyId}/bills/${billId}/void/`, {
    method: "POST",
    body: {},
  });
}

export async function fetchVendorPayments(companyId: string) {
  const payload = await apiRequest<VendorPayment[] | PaginatedResponse<VendorPayment>>(
    `/purchases/companies/${companyId}/vendor-payments/`
  );
  return normalizeListResponse(payload);
}

export async function fetchVendorPayment(companyId: string, vendorPaymentId: string) {
  return apiRequest<VendorPayment>(`/purchases/companies/${companyId}/vendor-payments/${vendorPaymentId}/`);
}

export async function createVendorPayment(
  companyId: string,
  payload: {
    vendor: string;
    paid_date: string;
    amount: string;
    currency_code?: string;
    payment_account: string;
    notes?: string;
  },
  idempotencyKey: string
) {
  return apiRequest<VendorPayment>(`/purchases/companies/${companyId}/vendor-payments/`, {
    method: "POST",
    body: payload,
    headers: { "Idempotency-Key": idempotencyKey },
  });
}

export async function updateVendorPayment(
  companyId: string,
  vendorPaymentId: string,
  payload: {
    vendor: string;
    paid_date: string;
    amount: string;
    currency_code?: string;
    payment_account: string;
    notes?: string;
  }
) {
  return apiRequest<VendorPayment>(`/purchases/companies/${companyId}/vendor-payments/${vendorPaymentId}/`, {
    method: "PUT",
    body: payload,
  });
}

export async function replaceVendorPaymentAllocations(
  companyId: string,
  vendorPaymentId: string,
  allocations: Array<{ bill_id: string; amount: string }>
) {
  return apiRequest<VendorPayment>(`/purchases/companies/${companyId}/vendor-payments/${vendorPaymentId}/allocations/`, {
    method: "PUT",
    body: { allocations },
  });
}

export async function postVendorPayment(companyId: string, vendorPaymentId: string, idempotencyKey: string) {
  return apiRequest<VendorPayment>(`/purchases/companies/${companyId}/vendor-payments/${vendorPaymentId}/post/`, {
    method: "POST",
    body: {},
    headers: { "Idempotency-Key": idempotencyKey },
  });
}

export async function voidVendorPayment(companyId: string, vendorPaymentId: string) {
  return apiRequest<VendorPayment>(`/purchases/companies/${companyId}/vendor-payments/${vendorPaymentId}/void/`, {
    method: "POST",
    body: {},
  });
}

export async function fetchAPAging(companyId: string, asOf?: string) {
  return apiRequest<APAgingRow[]>(withQuery(`/purchases/companies/${companyId}/reports/ap-aging/`, { as_of: asOf }));
}

export async function fetchBankAccounts(companyId: string) {
  const payload = await apiRequest<BankAccount[] | PaginatedResponse<BankAccount>>(
    `/banking/companies/${companyId}/bank-accounts/`
  );
  return normalizeListResponse(payload);
}

export async function createBankAccount(
  companyId: string,
  payload: {
    name: string;
    account_number_last4?: string;
    currency_code?: string;
    ledger_account: string;
    is_active?: boolean;
  }
) {
  return apiRequest<BankAccount>(`/banking/companies/${companyId}/bank-accounts/`, {
    method: "POST",
    body: payload,
  });
}

export async function updateBankAccount(
  companyId: string,
  bankAccountId: string,
  payload: {
    name: string;
    account_number_last4?: string;
    currency_code?: string;
    ledger_account: string;
    is_active?: boolean;
  }
) {
  return apiRequest<BankAccount>(`/banking/companies/${companyId}/bank-accounts/${bankAccountId}/`, {
    method: "PUT",
    body: payload,
  });
}

export async function deleteBankAccount(companyId: string, bankAccountId: string) {
  return apiRequest<null>(`/banking/companies/${companyId}/bank-accounts/${bankAccountId}/`, {
    method: "DELETE",
  });
}

export async function fetchBankImports(companyId: string, status?: string) {
  const payload = await apiRequest<BankStatementImport[] | PaginatedResponse<BankStatementImport>>(
    withQuery(`/banking/companies/${companyId}/imports/`, { status })
  );
  return normalizeListResponse(payload);
}

export async function createBankImport(
  companyId: string,
  payload: {
    bank_account: string;
    file_name: string;
    raw_content: string;
  }
) {
  return apiRequest<BankStatementImport>(`/banking/companies/${companyId}/imports/`, {
    method: "POST",
    body: payload,
  });
}

export async function fetchBankTransactions(
  companyId: string,
  options: {
    bank_account_id?: string;
    status?: string;
    date_from?: string;
    date_to?: string;
    limit?: number;
  } = {}
) {
  return apiRequest<BankTransaction[]>(
    withQuery(`/banking/companies/${companyId}/transactions/`, {
      bank_account_id: options.bank_account_id,
      status: options.status,
      date_from: options.date_from,
      date_to: options.date_to,
      limit: options.limit ? String(options.limit) : undefined,
    })
  );
}

export async function matchBankTransaction(companyId: string, transactionId: string, journalEntryId: string) {
  return apiRequest<BankTransaction>(`/banking/companies/${companyId}/transactions/${transactionId}/match/`, {
    method: "POST",
    body: { journal_entry_id: journalEntryId },
  });
}

export async function fetchReconciliations(companyId: string) {
  const payload = await apiRequest<BankReconciliation[] | PaginatedResponse<BankReconciliation>>(
    `/banking/companies/${companyId}/reconciliations/`
  );
  return normalizeListResponse(payload);
}

export async function createReconciliation(
  companyId: string,
  payload: {
    bank_account: string;
    start_date: string;
    end_date: string;
    opening_balance: string;
    closing_balance: string;
  }
) {
  return apiRequest<BankReconciliation>(`/banking/companies/${companyId}/reconciliations/`, {
    method: "POST",
    body: payload,
  });
}

export async function fetchReconciliation(companyId: string, reconciliationId: string) {
  return apiRequest<BankReconciliation>(`/banking/companies/${companyId}/reconciliations/${reconciliationId}/`);
}

export async function replaceReconciliationLines(companyId: string, reconciliationId: string, transactionIds: string[]) {
  return apiRequest<BankReconciliation>(`/banking/companies/${companyId}/reconciliations/${reconciliationId}/lines/`, {
    method: "PUT",
    body: { transaction_ids: transactionIds },
  });
}

export async function finalizeReconciliation(companyId: string, reconciliationId: string) {
  return apiRequest<BankReconciliation>(
    `/banking/companies/${companyId}/reconciliations/${reconciliationId}/finalize/`,
    {
      method: "POST",
      body: {},
    }
  );
}

export async function fetchProfitLoss(
  companyId: string,
  options: {
    start_date?: string;
    end_date?: string;
  } = {}
) {
  return apiRequest<ProfitLossReport>(
    withQuery(`/reports/companies/${companyId}/profit-loss/`, {
      start_date: options.start_date,
      end_date: options.end_date,
    })
  );
}

export async function fetchBalanceSheet(companyId: string, asOf?: string) {
  return apiRequest<BalanceSheetReport>(withQuery(`/reports/companies/${companyId}/balance-sheet/`, { as_of: asOf }));
}

export async function fetchCashFlow(
  companyId: string,
  options: {
    start_date?: string;
    end_date?: string;
  } = {}
) {
  return apiRequest<CashFlowReport>(
    withQuery(`/reports/companies/${companyId}/cash-flow/`, {
      start_date: options.start_date,
      end_date: options.end_date,
    })
  );
}

export async function fetchReportTrialBalance(
  companyId: string,
  options: {
    start_date?: string;
    end_date?: string;
  } = {}
) {
  return apiRequest<ReportTrialBalance>(
    withQuery(`/reports/companies/${companyId}/trial-balance/`, {
      start_date: options.start_date,
      end_date: options.end_date,
    })
  );
}

export async function fetchGeneralLedgerReport(
  companyId: string,
  options: {
    start_date?: string;
    end_date?: string;
    account_id?: string;
    limit?: number;
  } = {}
) {
  return apiRequest<GeneralLedgerReport>(
    withQuery(`/reports/companies/${companyId}/general-ledger/`, {
      start_date: options.start_date,
      end_date: options.end_date,
      account_id: options.account_id,
      limit: options.limit ? String(options.limit) : undefined,
    })
  );
}

export { ApiError };
export function formatApiError(error: unknown, fallback = "Request failed") {
  if (error instanceof ApiError) {
    let detail = fallback;
    let requestId = error.requestId;
    if (typeof error.payload === "string" && error.payload.trim()) {
      detail = error.payload;
    } else if (error.payload && typeof error.payload === "object") {
      const payload = error.payload as {
        detail?: unknown;
        request_id?: unknown;
        error?: { request_id?: unknown };
      };
      if (!requestId) {
        const nestedRequestId = payload.error?.request_id ?? payload.request_id;
        if (typeof nestedRequestId === "string" && nestedRequestId.trim()) {
          requestId = nestedRequestId;
        }
      }
      if (typeof payload.detail === "string" && payload.detail.trim()) {
        detail = payload.detail;
      } else {
        detail = JSON.stringify(error.payload);
      }
    }
    return requestId ? `${detail} (request_id: ${requestId})` : detail;
  }
  return fallback;
}

// ── System Admin API ──────────────────────────────────────────────────────────

import type {
  SystemAuditLog,
  SystemCompanyBootstrapInput,
  SystemCompanyBootstrapResult,
  SystemCompany,
  SystemCompanyDetail,
  SystemCompanyFeatureFlags,
  SystemCompanyMember,
  SystemCompanyQuotas,
  SystemGlobalFeatureFlags,
  SystemRole,
  SystemUserCreateInput,
  SystemUser,
  SystemUserDetail,
  SystemUserUpdateInput,
} from "@/lib/api-types";

export async function systemFetchCompanies() {
  const payload = await apiRequest<SystemCompany[] | PaginatedResponse<SystemCompany>>("/system/companies/");
  return normalizeListResponse(payload);
}

export async function systemFetchCompany(companyId: string) {
  return apiRequest<SystemCompanyDetail>(`/system/companies/${companyId}/`);
}

export async function systemBootstrapCompany(payload: SystemCompanyBootstrapInput) {
  return apiRequest<SystemCompanyBootstrapResult>("/system/companies/bootstrap/", {
    method: "POST",
    body: payload as Record<string, unknown>,
  });
}

export async function systemFetchCompanyFeatureFlags(companyId: string) {
  return apiRequest<{ company_id: string; company_slug: string; feature_flags: SystemCompanyFeatureFlags }>(
    `/system/companies/${companyId}/feature-flags/`
  );
}

export async function systemUpdateCompanyFeatureFlags(
  companyId: string,
  updates: Partial<SystemCompanyFeatureFlags>
) {
  return apiRequest<{ company_id: string; company_slug: string; feature_flags: SystemCompanyFeatureFlags }>(
    `/system/companies/${companyId}/feature-flags/`,
    { method: "PATCH", body: updates as Record<string, unknown> }
  );
}

export async function systemFetchCompanyQuotas(companyId: string) {
  return apiRequest<{ company_id: string; company_slug: string; quotas: SystemCompanyQuotas }>(
    `/system/companies/${companyId}/quotas/`
  );
}

export async function systemUpdateCompanyQuotas(companyId: string, updates: Partial<SystemCompanyQuotas>) {
  return apiRequest<{ company_id: string; company_slug: string; quotas: SystemCompanyQuotas }>(
    `/system/companies/${companyId}/quotas/`,
    { method: "PATCH", body: updates as Record<string, unknown> }
  );
}

export async function systemUpdateCompanyStatus(companyId: string, is_active: boolean) {
  return apiRequest<{ company_id: string; company_slug: string; is_active: boolean }>(
    `/system/companies/${companyId}/status/`,
    { method: "PATCH", body: { is_active } }
  );
}

export async function systemFetchUsers() {
  const payload = await apiRequest<SystemUser[] | PaginatedResponse<SystemUser>>("/system/users/");
  return normalizeListResponse(payload);
}

export async function systemCreateUser(payload: SystemUserCreateInput) {
  return apiRequest<SystemUserDetail>("/system/users/", {
    method: "POST",
    body: payload as Record<string, unknown>,
  });
}

export async function systemFetchUser(userId: string) {
  return apiRequest<SystemUserDetail>(`/system/users/${userId}/`);
}

export async function systemUpdateUser(userId: string, updates: SystemUserUpdateInput) {
  return apiRequest<SystemUserDetail>(`/system/users/${userId}/`, {
    method: "PATCH",
    body: updates as Record<string, unknown>,
  });
}

export async function systemResetUserPassword(userId: string, newPassword: string) {
  return apiRequest<{ user_id: string; user_email: string; password_reset: boolean }>(
    `/system/users/${userId}/reset-password/`,
    {
      method: "POST",
      body: { new_password: newPassword },
    }
  );
}

export async function systemDeactivateUser(userId: string) {
  return apiRequest<void>(`/system/users/${userId}/`, {
    method: "DELETE",
    body: {},
  });
}

export async function systemUpdateUserRole(
  userId: string,
  updates: { role?: string | null; is_active?: boolean }
) {
  return apiRequest<{ user_id: string; user_email: string; system_role: { role: SystemRole; is_active: boolean } | null }>(
    `/system/users/${userId}/system-role/`,
    { method: "PATCH", body: updates as Record<string, unknown> }
  );
}

export async function systemUpsertCompanyMember(
  companyId: string,
  payload: { user_id: string; status?: string; roles?: string[] }
) {
  return apiRequest<SystemCompanyMember>(`/system/companies/${companyId}/members/`, {
    method: "POST",
    body: payload as Record<string, unknown>,
  });
}

export async function systemReplaceCompanyMemberRoles(companyId: string, userId: string, roles: string[]) {
  return apiRequest<{ company_id: string; user_id: string; roles: string[] }>(
    `/system/companies/${companyId}/members/${userId}/roles/`,
    {
      method: "PATCH",
      body: { roles },
    }
  );
}

export async function systemRemoveCompanyMember(companyId: string, userId: string) {
  return apiRequest<void>(`/system/companies/${companyId}/members/${userId}/`, {
    method: "DELETE",
    body: {},
  });
}

export async function systemFetchAuditLogs(filters: {
  action?: string;
  resource_type?: string;
  actor_id?: string;
  date_from?: string;
  date_to?: string;
} = {}) {
  const payload = await apiRequest<SystemAuditLog[] | PaginatedResponse<SystemAuditLog>>(
    withQuery("/system/audit-logs/", {
      action: filters.action,
      resource_type: filters.resource_type,
      actor_id: filters.actor_id,
      date_from: filters.date_from,
      date_to: filters.date_to,
    })
  );
  return normalizeListResponse(payload);
}

export async function systemFetchGlobalFeatureFlags() {
  return apiRequest<SystemGlobalFeatureFlags>("/system/feature-flags/");
}

export async function systemHealthCheck() {
  return apiRequest<{ status: string }>("/system/health/");
}
