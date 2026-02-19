"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { fetchAccounts, fetchGeneralLedgerReport } from "@/lib/api-client";
import type { Account, GeneralLedgerReport } from "@/lib/api-types";
import { useCompanyContext } from "@/lib/use-company-context";

export default function GeneralLedgerReportPage() {
  const params = useParams<{ companySlug: string }>();
  const companySlug = params.companySlug;
  const { isLoading, error, user, companies, activeCompany, access, handleNavigate, handleLogout } =
    useCompanyContext(companySlug);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [report, setReport] = useState<GeneralLedgerReport | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [filters, setFilters] = useState({
    start_date: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().slice(0, 10),
    end_date: new Date().toISOString().slice(0, 10),
    account_id: "",
    limit: "200",
  });

  const loadData = useCallback(async (companyId: string, forceFilters = filters) => {
    setLoadingReport(true);
    try {
      const [reportData, accountData] = await Promise.all([
        fetchGeneralLedgerReport(companyId, {
          start_date: forceFilters.start_date,
          end_date: forceFilters.end_date,
          account_id: forceFilters.account_id || undefined,
          limit: Number(forceFilters.limit) || 200,
        }),
        fetchAccounts(companyId),
      ]);
      setReport(reportData);
      setAccounts(accountData);
    } finally {
      setLoadingReport(false);
    }
  }, [filters]);

  useEffect(() => {
    if (!activeCompany) {
      return;
    }
    const companyId = activeCompany.id;
    void loadData(companyId);
  }, [activeCompany, loadData]);

  async function handleRefresh(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeCompany) {
      return;
    }
    await loadData(activeCompany.id);
  }

  if (isLoading) {
    return <main className="flex min-h-screen items-center justify-center text-sm text-zinc-600">Loading...</main>;
  }

  if (error || !user || !activeCompany || !access) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <section className="w-full max-w-md rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          <p>{error || "Access context is missing."}</p>
          <button className="mt-3 text-sm underline" onClick={handleLogout}>
            Go to login
          </button>
        </section>
      </main>
    );
  }

  return (
    <AppShell
      user={user}
      companies={companies}
      activeCompany={activeCompany}
      access={access}
      onLogout={handleLogout}
      onNavigate={handleNavigate}
    >
      <div className="rounded-lg border border-zinc-200 p-4">
        <h2 className="text-lg font-medium text-zinc-900">General Ledger (Report)</h2>
        <p className="mt-1 text-sm text-zinc-600">Ledger lines with date range, account filter, and row limit.</p>

        <form className="mt-4 grid gap-2 md:grid-cols-5" onSubmit={handleRefresh}>
          <input
            type="date"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            value={filters.start_date}
            onChange={(event) => setFilters((prev) => ({ ...prev, start_date: event.target.value }))}
          />
          <input
            type="date"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            value={filters.end_date}
            onChange={(event) => setFilters((prev) => ({ ...prev, end_date: event.target.value }))}
          />
          <select
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            value={filters.account_id}
            onChange={(event) => setFilters((prev) => ({ ...prev, account_id: event.target.value }))}
          >
            <option value="">All accounts</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.code} - {account.name}
              </option>
            ))}
          </select>
          <input
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            value={filters.limit}
            onChange={(event) => setFilters((prev) => ({ ...prev, limit: event.target.value }))}
            placeholder="Limit"
          />
          <button className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50">
            Refresh
          </button>
        </form>

        {loadingReport || !report ? (
          <p className="mt-4 text-sm text-zinc-600">Loading report...</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-600">
                  <th className="py-2 pr-3">Entry #</th>
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Account</th>
                  <th className="py-2 pr-3">Description</th>
                  <th className="py-2 pr-3">Debit</th>
                  <th className="py-2 pr-3">Credit</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row) => (
                  <tr key={row.line_id} className="border-b border-zinc-100">
                    <td className="py-2 pr-3">{row.entry_no ?? "-"}</td>
                    <td className="py-2 pr-3">{row.entry_date}</td>
                    <td className="py-2 pr-3">
                      {row.account_code} - {row.account_name}
                    </td>
                    <td className="py-2 pr-3">{row.description || "-"}</td>
                    <td className="py-2 pr-3">{row.debit}</td>
                    <td className="py-2 pr-3">{row.credit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
