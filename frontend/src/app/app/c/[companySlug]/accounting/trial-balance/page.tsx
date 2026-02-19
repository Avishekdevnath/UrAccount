"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { fetchTrialBalance } from "@/lib/api-client";
import type { TrialBalanceRow } from "@/lib/api-types";
import { useCompanyContext } from "@/lib/use-company-context";

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function TrialBalancePage() {
  const params = useParams<{ companySlug: string }>();
  const companySlug = params.companySlug;
  const { isLoading, error, user, companies, activeCompany, access, handleNavigate, handleLogout } =
    useCompanyContext(companySlug);
  const [rows, setRows] = useState<TrialBalanceRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);

  useEffect(() => {
    if (!activeCompany) {
      return;
    }
    const companyId = activeCompany.id;
    async function loadTrialBalance() {
      setLoadingRows(true);
      try {
        const data = await fetchTrialBalance(companyId);
        setRows(data);
      } finally {
        setLoadingRows(false);
      }
    }
    void loadTrialBalance();
  }, [activeCompany]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.debit += toNumber(row.total_debit);
        acc.credit += toNumber(row.total_credit);
        return acc;
      },
      { debit: 0, credit: 0 }
    );
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
        <h2 className="text-lg font-medium text-zinc-900">Trial Balance</h2>
        <p className="mt-1 text-sm text-zinc-600">Posted ledger totals by account.</p>

        <div className="mt-4 overflow-x-auto">
          {loadingRows ? (
            <p className="text-sm text-zinc-600">Loading trial balance...</p>
          ) : (
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-600">
                  <th className="py-2 pr-3">Code</th>
                  <th className="py-2 pr-3">Account</th>
                  <th className="py-2 pr-3">Debit</th>
                  <th className="py-2 pr-3">Credit</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.account__id} className="border-b border-zinc-100">
                    <td className="py-2 pr-3 font-mono">{row.account__code}</td>
                    <td className="py-2 pr-3">{row.account__name}</td>
                    <td className="py-2 pr-3">{row.total_debit}</td>
                    <td className="py-2 pr-3">{row.total_credit}</td>
                  </tr>
                ))}
                <tr className="border-t border-zinc-300 font-semibold">
                  <td className="py-2 pr-3" colSpan={2}>
                    Total
                  </td>
                  <td className="py-2 pr-3">{totals.debit.toFixed(2)}</td>
                  <td className="py-2 pr-3">{totals.credit.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppShell>
  );
}
