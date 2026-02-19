"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { ApiError, fetchBankTransactions, matchBankTransaction } from "@/lib/api-client";
import type { BankTransaction } from "@/lib/api-types";
import { useCompanyContext } from "@/lib/use-company-context";

export default function BankingTransactionsPage() {
  const params = useParams<{ companySlug: string }>();
  const companySlug = params.companySlug;
  const { isLoading, error, user, companies, activeCompany, access, handleNavigate, handleLogout } =
    useCompanyContext(companySlug);

  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [matchJournalId, setMatchJournalId] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState("");

  const canPost = !!access?.permissions.includes("accounting.post");

  const loadTransactions = useCallback(async (companyId: string, status: string) => {
    setLoadingTransactions(true);
    try {
      const data = await fetchBankTransactions(companyId, {
        status: status || undefined,
      });
      setTransactions(data);
    } finally {
      setLoadingTransactions(false);
    }
  }, []);

  useEffect(() => {
    if (!activeCompany) {
      return;
    }
    const companyId = activeCompany.id;
    void loadTransactions(companyId, statusFilter);
  }, [activeCompany, loadTransactions, statusFilter]);

  async function handleRefresh(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeCompany) {
      return;
    }
    await loadTransactions(activeCompany.id, statusFilter);
  }

  async function handleMatch(transactionId: string) {
    if (!activeCompany || !canPost) {
      return;
    }
    setActionError("");
    const journalId = (matchJournalId[transactionId] || "").trim();
    if (!journalId) {
      setActionError("Provide a journal entry id before matching.");
      return;
    }
    try {
      await matchBankTransaction(activeCompany.id, transactionId, journalId);
      await loadTransactions(activeCompany.id, statusFilter);
    } catch (err) {
      if (err instanceof ApiError) {
        setActionError(`Match failed (${err.status}).`);
      } else {
        setActionError("Match failed.");
      }
    }
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
        <h2 className="text-lg font-medium text-zinc-900">Bank Transactions</h2>
        <p className="mt-1 text-sm text-zinc-600">Review imported transactions and manually match posted journals.</p>

        <form className="mt-4 flex flex-wrap items-end gap-2" onSubmit={handleRefresh}>
          <div>
            <label className="mb-1 block text-xs text-zinc-600" htmlFor="txn-status-filter">
              Status
            </label>
            <select
              id="txn-status-filter"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="">All</option>
              <option value="imported">Imported</option>
              <option value="matched">Matched</option>
              <option value="reconciled">Reconciled</option>
              <option value="ignored">Ignored</option>
            </select>
          </div>
          <button className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50">
            Refresh
          </button>
        </form>

        {actionError ? <p className="mt-2 text-sm text-red-600">{actionError}</p> : null}

        <div className="mt-6 overflow-x-auto">
          {loadingTransactions ? (
            <p className="text-sm text-zinc-600">Loading transactions...</p>
          ) : (
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-600">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Description</th>
                  <th className="py-2 pr-3">Amount</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Matched Entry</th>
                  <th className="py-2 pr-3">Match Action</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => (
                  <tr key={transaction.id} className="border-b border-zinc-100">
                    <td className="py-2 pr-3">{transaction.txn_date}</td>
                    <td className="py-2 pr-3">{transaction.description || "-"}</td>
                    <td className="py-2 pr-3">{transaction.amount}</td>
                    <td className="py-2 pr-3 uppercase">{transaction.status}</td>
                    <td className="py-2 pr-3">{transaction.matched_entry_no ?? "-"}</td>
                    <td className="py-2 pr-3">
                      <div className="flex gap-2">
                        <input
                          className="rounded border border-zinc-300 px-2 py-1 text-xs"
                          placeholder="Journal UUID"
                          value={matchJournalId[transaction.id] || ""}
                          onChange={(event) =>
                            setMatchJournalId((prev) => ({ ...prev, [transaction.id]: event.target.value }))
                          }
                        />
                        <button
                          disabled={!canPost || transaction.status === "reconciled"}
                          onClick={() => handleMatch(transaction.id)}
                          className="rounded border border-zinc-300 px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          Match
                        </button>
                      </div>
                    </td>
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
