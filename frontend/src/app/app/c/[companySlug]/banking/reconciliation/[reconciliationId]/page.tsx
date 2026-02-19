"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import {
  ApiError,
  fetchBankTransactions,
  fetchReconciliation,
  finalizeReconciliation,
  replaceReconciliationLines,
} from "@/lib/api-client";
import type { BankReconciliation, BankTransaction } from "@/lib/api-types";
import { getCompanyReconciliationsPath } from "@/lib/company-routing";
import { useCompanyContext } from "@/lib/use-company-context";

export default function ReconciliationDetailPage() {
  const params = useParams<{ companySlug: string; reconciliationId: string }>();
  const companySlug = params.companySlug;
  const reconciliationId = params.reconciliationId;
  const { isLoading, error, user, companies, activeCompany, access, handleNavigate, handleLogout } =
    useCompanyContext(companySlug);

  const [reconciliation, setReconciliation] = useState<BankReconciliation | null>(null);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [actionError, setActionError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");

  const canPost = !!access?.permissions.includes("accounting.post");
  const canEditDraft = !!(canPost && reconciliation?.status === "draft");

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const loadData = useCallback(async (companyId: string) => {
    setLoadingData(true);
    try {
      const [reconciliationData, transactionData] = await Promise.all([
        fetchReconciliation(companyId, reconciliationId),
        fetchBankTransactions(companyId, { limit: 500 }),
      ]);
      setReconciliation(reconciliationData);
      setTransactions(transactionData);
      const lineIds = reconciliationData.lines?.map((line) => line.bank_transaction_id) || [];
      setSelectedIds(lineIds);
    } finally {
      setLoadingData(false);
    }
  }, [reconciliationId]);

  useEffect(() => {
    if (!activeCompany) {
      return;
    }
    const companyId = activeCompany.id;
    void loadData(companyId);
  }, [activeCompany, loadData]);

  async function handleSaveLines() {
    if (!activeCompany || !canEditDraft) {
      return;
    }
    setActionError("");
    setInfoMessage("");
    try {
      await replaceReconciliationLines(activeCompany.id, reconciliationId, selectedIds);
      await loadData(activeCompany.id);
      setInfoMessage("Reconciliation lines saved.");
    } catch (err) {
      if (err instanceof ApiError) {
        setActionError(`Save lines failed (${err.status}).`);
      } else {
        setActionError("Save lines failed.");
      }
    }
  }

  async function handleFinalize() {
    if (!activeCompany || !canEditDraft) {
      return;
    }
    setActionError("");
    setInfoMessage("");
    try {
      await finalizeReconciliation(activeCompany.id, reconciliationId);
      await loadData(activeCompany.id);
      setInfoMessage("Reconciliation finalized.");
    } catch (err) {
      if (err instanceof ApiError) {
        setActionError(`Finalize failed (${err.status}).`);
      } else {
        setActionError("Finalize failed.");
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-medium text-zinc-900">Reconciliation Detail</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Status: {reconciliation?.status?.toUpperCase() || "-"} | {reconciliation?.start_date} to{" "}
              {reconciliation?.end_date}
            </p>
          </div>
          <button
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
            onClick={() => handleNavigate(getCompanyReconciliationsPath(activeCompany.slug))}
          >
            Back
          </button>
        </div>

        {loadingData || !reconciliation ? (
          <p className="mt-4 text-sm text-zinc-600">Loading reconciliation...</p>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={handleSaveLines}
                disabled={!canEditDraft}
                className="rounded border border-zinc-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-45"
              >
                Save Selected Lines
              </button>
              <button
                onClick={handleFinalize}
                disabled={!canEditDraft}
                className="rounded border border-zinc-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-45"
              >
                Finalize
              </button>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-zinc-600">
                    <th className="py-2 pr-3">Select</th>
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 pr-3">Description</th>
                    <th className="py-2 pr-3">Amount</th>
                    <th className="py-2 pr-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction) => (
                    <tr key={transaction.id} className="border-b border-zinc-100">
                      <td className="py-2 pr-3">
                        <input
                          type="checkbox"
                          checked={selectedSet.has(transaction.id)}
                          disabled={!canEditDraft}
                          onChange={(event) =>
                            setSelectedIds((prev) => {
                              if (event.target.checked) {
                                return [...prev, transaction.id];
                              }
                              return prev.filter((id) => id !== transaction.id);
                            })
                          }
                        />
                      </td>
                      <td className="py-2 pr-3">{transaction.txn_date}</td>
                      <td className="py-2 pr-3">{transaction.description || "-"}</td>
                      <td className="py-2 pr-3">{transaction.amount}</td>
                      <td className="py-2 pr-3 uppercase">{transaction.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {actionError ? <p className="mt-2 text-sm text-red-600">{actionError}</p> : null}
        {infoMessage ? <p className="mt-2 text-sm text-green-700">{infoMessage}</p> : null}
      </div>
    </AppShell>
  );
}
