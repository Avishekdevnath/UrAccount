"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { fetchProfitLoss } from "@/lib/api-client";
import type { ProfitLossReport } from "@/lib/api-types";
import { useCompanyContext } from "@/lib/use-company-context";

export default function ProfitLossPage() {
  const params = useParams<{ companySlug: string }>();
  const companySlug = params.companySlug;
  const { isLoading, error, user, companies, activeCompany, access, handleNavigate, handleLogout } =
    useCompanyContext(companySlug);
  const [report, setReport] = useState<ProfitLossReport | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [filters, setFilters] = useState({
    start_date: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().slice(0, 10),
    end_date: new Date().toISOString().slice(0, 10),
  });

  async function loadReport(companyId: string, startDate: string, endDate: string) {
    setLoadingReport(true);
    try {
      const data = await fetchProfitLoss(companyId, { start_date: startDate, end_date: endDate });
      setReport(data);
    } finally {
      setLoadingReport(false);
    }
  }

  useEffect(() => {
    if (!activeCompany) {
      return;
    }
    const companyId = activeCompany.id;
    void loadReport(companyId, filters.start_date, filters.end_date);
  }, [activeCompany, filters.end_date, filters.start_date]);

  async function handleRefresh(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeCompany) {
      return;
    }
    await loadReport(activeCompany.id, filters.start_date, filters.end_date);
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
        <h2 className="text-lg font-medium text-zinc-900">Profit & Loss</h2>
        <p className="mt-1 text-sm text-zinc-600">Income and expense performance over a date range.</p>

        <form className="mt-4 flex flex-wrap items-end gap-2" onSubmit={handleRefresh}>
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
          <button className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50">
            Refresh
          </button>
        </form>

        {loadingReport || !report ? (
          <p className="mt-4 text-sm text-zinc-600">Loading report...</p>
        ) : (
          <>
            <div className="mt-4 grid gap-2 text-sm md:grid-cols-3">
              <div className="rounded-md border border-zinc-200 bg-zinc-50 p-2">Income: {report.income_total}</div>
              <div className="rounded-md border border-zinc-200 bg-zinc-50 p-2">Expense: {report.expense_total}</div>
              <div className="rounded-md border border-zinc-200 bg-zinc-100 p-2 font-medium">
                Net Profit: {report.net_profit}
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-zinc-600">
                    <th className="py-2 pr-3">Code</th>
                    <th className="py-2 pr-3">Account</th>
                    <th className="py-2 pr-3">Type</th>
                    <th className="py-2 pr-3">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((row) => (
                    <tr key={row.account_id} className="border-b border-zinc-100">
                      <td className="py-2 pr-3 font-mono">{row.account_code}</td>
                      <td className="py-2 pr-3">{row.account_name}</td>
                      <td className="py-2 pr-3">{row.account_type}</td>
                      <td className="py-2 pr-3">{row.balance}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
