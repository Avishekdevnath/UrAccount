"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { fetchARAging } from "@/lib/api-client";
import type { ARAgingRow } from "@/lib/api-types";
import { useCompanyContext } from "@/lib/use-company-context";

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function ARAgingPage() {
  const params = useParams<{ companySlug: string }>();
  const companySlug = params.companySlug;
  const { isLoading, error, user, companies, activeCompany, access, handleNavigate, handleLogout } =
    useCompanyContext(companySlug);
  const [rows, setRows] = useState<ARAgingRow[]>([]);
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10));
  const [loadingRows, setLoadingRows] = useState(false);

  async function loadRows(companyId: string, asOfDate: string) {
    setLoadingRows(true);
    try {
      const data = await fetchARAging(companyId, asOfDate || undefined);
      setRows(data);
    } finally {
      setLoadingRows(false);
    }
  }

  useEffect(() => {
    if (!activeCompany) {
      return;
    }
    void loadRows(activeCompany.id, asOf);
  }, [activeCompany, asOf]);

  async function handleRefresh(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeCompany) {
      return;
    }
    await loadRows(activeCompany.id, asOf);
  }

  const bucketTotals = useMemo(() => {
    const summary = {
      "0-30": 0,
      "31-60": 0,
      "61-90": 0,
      "90+": 0,
      total: 0,
    };
    for (const row of rows) {
      const amount = toNumber(row.open_amount);
      summary[row.bucket] += amount;
      summary.total += amount;
    }
    return summary;
  }, [rows]);

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
        <h2 className="text-lg font-medium text-zinc-900">AR Aging</h2>
        <p className="mt-1 text-sm text-zinc-600">Open invoice balances by aging bucket.</p>

        <form className="mt-4 flex flex-wrap items-end gap-2" onSubmit={handleRefresh}>
          <div>
            <label className="mb-1 block text-xs text-zinc-600" htmlFor="ar-as-of">
              As of
            </label>
            <input
              id="ar-as-of"
              type="date"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={asOf}
              onChange={(event) => setAsOf(event.target.value)}
            />
          </div>
          <button className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50">
            Refresh
          </button>
        </form>

        <div className="mt-4 grid gap-2 text-sm md:grid-cols-5">
          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-2">0-30: {bucketTotals["0-30"].toFixed(2)}</div>
          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-2">
            31-60: {bucketTotals["31-60"].toFixed(2)}
          </div>
          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-2">
            61-90: {bucketTotals["61-90"].toFixed(2)}
          </div>
          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-2">90+: {bucketTotals["90+"].toFixed(2)}</div>
          <div className="rounded-md border border-zinc-200 bg-zinc-100 p-2 font-medium">
            Total: {bucketTotals.total.toFixed(2)}
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          {loadingRows ? (
            <p className="text-sm text-zinc-600">Loading AR aging...</p>
          ) : (
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-600">
                  <th className="py-2 pr-3">Invoice #</th>
                  <th className="py-2 pr-3">Customer</th>
                  <th className="py-2 pr-3">Due Date</th>
                  <th className="py-2 pr-3">Age (days)</th>
                  <th className="py-2 pr-3">Bucket</th>
                  <th className="py-2 pr-3">Open Amount</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.invoice_id} className="border-b border-zinc-100">
                    <td className="py-2 pr-3">{row.invoice_no ?? "-"}</td>
                    <td className="py-2 pr-3">{row.customer_name}</td>
                    <td className="py-2 pr-3">{row.due_date}</td>
                    <td className="py-2 pr-3">{row.age_days}</td>
                    <td className="py-2 pr-3">{row.bucket}</td>
                    <td className="py-2 pr-3">{row.open_amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppShell>
  );
}
