"use client";

import type { ReactNode } from "react";

import type { Company, CompanyAccess, UserMe } from "@/lib/api-types";
import {
  getCompanyAPAgingPath,
  getCompanyARAgingPath,
  getCompanyBalanceSheetPath,
  getCompanyBankAccountsPath,
  getCompanyBankImportsPath,
  getCompanyBankTransactionsPath,
  getCompanyBillsPath,
  getCompanyCashFlowPath,
  getCompanyChartOfAccountsPath,
  getCompanyCustomersPath,
  getCompanyDashboardPath,
  getCompanyGeneralLedgerPath,
  getCompanyInvoicesPath,
  getCompanyJournalsPath,
  getCompanyProfitLossPath,
  getCompanyReconciliationsPath,
  getCompanyReportTrialBalancePath,
  getCompanyReceiptsPath,
  getCompanyTrialBalancePath,
  getCompanyVendorPaymentsPath,
  getCompanyVendorsPath,
} from "@/lib/company-routing";

type AppShellProps = {
  user: UserMe;
  companies: Company[];
  activeCompany: Company;
  access: CompanyAccess;
  onLogout: () => void;
  onNavigate: (path: string) => void;
  children: ReactNode;
};

function ActionButton({
  label,
  enabled,
}: {
  label: string;
  enabled: boolean;
}) {
  return (
    <button
      type="button"
      disabled={!enabled}
      className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700 disabled:cursor-not-allowed disabled:opacity-45"
      title={enabled ? label : "Role permission required"}
    >
      {label}
    </button>
  );
}

export function AppShell({
  user,
  companies,
  activeCompany,
  access,
  onLogout,
  onNavigate,
  children,
}: AppShellProps) {
  const canManageCompany = access.permissions.includes("company.manage");
  const canManageMembers = access.permissions.includes("members.manage");

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-8">
      <section className="mx-auto w-full max-w-5xl rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">URAccount</h1>
            <p className="mt-1 text-sm text-zinc-600">
              {user.full_name} ({user.email})
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-zinc-600" htmlFor="company-switcher">
              Company
            </label>
            <select
              id="company-switcher"
              className="rounded-md border border-zinc-300 px-2 py-1 text-sm"
              value={activeCompany.slug}
              onChange={(event) => onNavigate(getCompanyDashboardPath(event.target.value))}
            >
              {companies.map((company) => (
                <option key={company.id} value={company.slug}>
                  {company.name}
                </option>
              ))}
            </select>
            <button
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
              onClick={onLogout}
            >
              Logout
            </button>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
          <p className="text-sm text-zinc-700">
            Active Company: <span className="font-medium">{activeCompany.name}</span> ({activeCompany.slug})
          </p>
          <p className="mt-1 text-sm text-zinc-700">Roles: {access.roles.join(", ") || "None"}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <ActionButton label="Manage Company Settings" enabled={canManageCompany} />
            <ActionButton label="Invite Members" enabled={canManageMembers} />
          </div>
        </div>

        <nav className="mt-4 flex flex-wrap gap-2">
          <button
            className="rounded-md border border-zinc-300 px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-50"
            onClick={() => onNavigate(getCompanyDashboardPath(activeCompany.slug))}
          >
            Dashboard
          </button>
          <button
            className="rounded-md border border-zinc-300 px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-50"
            onClick={() => onNavigate(getCompanyChartOfAccountsPath(activeCompany.slug))}
          >
            Chart of Accounts
          </button>
          <button
            className="rounded-md border border-zinc-300 px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-50"
            onClick={() => onNavigate(getCompanyJournalsPath(activeCompany.slug))}
          >
            Journals
          </button>
          <button
            className="rounded-md border border-zinc-300 px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-50"
            onClick={() => onNavigate(getCompanyTrialBalancePath(activeCompany.slug))}
          >
            Trial Balance
          </button>
          <button
            className="rounded-md border border-zinc-300 px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-50"
            onClick={() => onNavigate(getCompanyCustomersPath(activeCompany.slug))}
          >
            Customers
          </button>
          <button
            className="rounded-md border border-zinc-300 px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-50"
            onClick={() => onNavigate(getCompanyInvoicesPath(activeCompany.slug))}
          >
            Invoices
          </button>
          <button
            className="rounded-md border border-zinc-300 px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-50"
            onClick={() => onNavigate(getCompanyReceiptsPath(activeCompany.slug))}
          >
            Receipts
          </button>
          <button
            className="rounded-md border border-zinc-300 px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-50"
            onClick={() => onNavigate(getCompanyARAgingPath(activeCompany.slug))}
          >
            AR Aging
          </button>
          <button
            className="rounded-md border border-zinc-300 px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-50"
            onClick={() => onNavigate(getCompanyVendorsPath(activeCompany.slug))}
          >
            Vendors
          </button>
          <button
            className="rounded-md border border-zinc-300 px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-50"
            onClick={() => onNavigate(getCompanyBillsPath(activeCompany.slug))}
          >
            Bills
          </button>
          <button
            className="rounded-md border border-zinc-300 px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-50"
            onClick={() => onNavigate(getCompanyVendorPaymentsPath(activeCompany.slug))}
          >
            Vendor Payments
          </button>
          <button
            className="rounded-md border border-zinc-300 px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-50"
            onClick={() => onNavigate(getCompanyAPAgingPath(activeCompany.slug))}
          >
            AP Aging
          </button>
          <button
            className="rounded-md border border-zinc-300 px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-50"
            onClick={() => onNavigate(getCompanyBankAccountsPath(activeCompany.slug))}
          >
            Bank Accounts
          </button>
          <button
            className="rounded-md border border-zinc-300 px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-50"
            onClick={() => onNavigate(getCompanyBankImportsPath(activeCompany.slug))}
          >
            Bank Imports
          </button>
          <button
            className="rounded-md border border-zinc-300 px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-50"
            onClick={() => onNavigate(getCompanyBankTransactionsPath(activeCompany.slug))}
          >
            Bank Txns
          </button>
          <button
            className="rounded-md border border-zinc-300 px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-50"
            onClick={() => onNavigate(getCompanyReconciliationsPath(activeCompany.slug))}
          >
            Reconciliation
          </button>
          <button
            className="rounded-md border border-zinc-300 px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-50"
            onClick={() => onNavigate(getCompanyProfitLossPath(activeCompany.slug))}
          >
            Profit & Loss
          </button>
          <button
            className="rounded-md border border-zinc-300 px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-50"
            onClick={() => onNavigate(getCompanyBalanceSheetPath(activeCompany.slug))}
          >
            Balance Sheet
          </button>
          <button
            className="rounded-md border border-zinc-300 px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-50"
            onClick={() => onNavigate(getCompanyCashFlowPath(activeCompany.slug))}
          >
            Cash Flow
          </button>
          <button
            className="rounded-md border border-zinc-300 px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-50"
            onClick={() => onNavigate(getCompanyReportTrialBalancePath(activeCompany.slug))}
          >
            Report TB
          </button>
          <button
            className="rounded-md border border-zinc-300 px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-50"
            onClick={() => onNavigate(getCompanyGeneralLedgerPath(activeCompany.slug))}
          >
            Report GL
          </button>
        </nav>

        <div className="mt-6">{children}</div>
      </section>
    </main>
  );
}
