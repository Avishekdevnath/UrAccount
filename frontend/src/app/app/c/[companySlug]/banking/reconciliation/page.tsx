"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { ApiError, createReconciliation, fetchBankAccounts, fetchReconciliations } from "@/lib/api-client";
import type { BankAccount, BankReconciliation } from "@/lib/api-types";
import { getCompanyReconciliationDetailPath } from "@/lib/company-routing";
import { useCompanyContext } from "@/lib/use-company-context";

export default function ReconciliationPage() {
  const params = useParams<{ companySlug: string }>();
  const companySlug = params.companySlug;
  const { isLoading, error, user, companies, activeCompany, access, handleNavigate, handleLogout } =
    useCompanyContext(companySlug);

  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [reconciliations, setReconciliations] = useState<BankReconciliation[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({
    bank_account: "",
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date().toISOString().slice(0, 10),
    opening_balance: "0.00",
    closing_balance: "0.00",
  });

  const canPost = !!access?.permissions.includes("accounting.post");

  async function loadData(companyId: string) {
    setLoadingData(true);
    try {
      const [bankAccountData, reconciliationData] = await Promise.all([
        fetchBankAccounts(companyId),
        fetchReconciliations(companyId),
      ]);
      setBankAccounts(bankAccountData);
      setReconciliations(reconciliationData);
      setForm((prev) => ({
        ...prev,
        bank_account: prev.bank_account || bankAccountData[0]?.id || "",
      }));
    } finally {
      setLoadingData(false);
    }
  }

  useEffect(() => {
    if (!activeCompany) {
      return;
    }
    const companyId = activeCompany.id;
    void loadData(companyId);
  }, [activeCompany]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeCompany || !canPost) {
      return;
    }
    setFormError("");
    try {
      await createReconciliation(activeCompany.id, form);
      await loadData(activeCompany.id);
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(`Create failed (${err.status}).`);
      } else {
        setFormError("Create failed.");
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
        <h2 className="text-lg font-medium text-zinc-900">Reconciliations</h2>
        <p className="mt-1 text-sm text-zinc-600">Create a reconciliation period and finalize selected transactions.</p>

        <form className="mt-4 grid gap-3 md:grid-cols-5" onSubmit={handleCreate}>
          <select
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            value={form.bank_account}
            onChange={(event) => setForm((prev) => ({ ...prev, bank_account: event.target.value }))}
            required
          >
            <option value="">Bank account</option>
            {bankAccounts.map((bankAccount) => (
              <option key={bankAccount.id} value={bankAccount.id}>
                {bankAccount.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            value={form.start_date}
            onChange={(event) => setForm((prev) => ({ ...prev, start_date: event.target.value }))}
            required
          />
          <input
            type="date"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            value={form.end_date}
            onChange={(event) => setForm((prev) => ({ ...prev, end_date: event.target.value }))}
            required
          />
          <input
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            value={form.opening_balance}
            onChange={(event) => setForm((prev) => ({ ...prev, opening_balance: event.target.value }))}
            placeholder="Opening"
            required
          />
          <input
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            value={form.closing_balance}
            onChange={(event) => setForm((prev) => ({ ...prev, closing_balance: event.target.value }))}
            placeholder="Closing"
            required
          />
          <button
            type="submit"
            disabled={!canPost}
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-45 md:col-span-5 md:w-fit"
          >
            Create Reconciliation
          </button>
        </form>
        {formError ? <p className="mt-2 text-sm text-red-600">{formError}</p> : null}

        <div className="mt-6 overflow-x-auto">
          {loadingData ? (
            <p className="text-sm text-zinc-600">Loading reconciliations...</p>
          ) : (
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-600">
                  <th className="py-2 pr-3">Bank Account</th>
                  <th className="py-2 pr-3">Start</th>
                  <th className="py-2 pr-3">End</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {reconciliations.map((reconciliation) => (
                  <tr key={reconciliation.id} className="border-b border-zinc-100">
                    <td className="py-2 pr-3">{reconciliation.bank_account}</td>
                    <td className="py-2 pr-3">{reconciliation.start_date}</td>
                    <td className="py-2 pr-3">{reconciliation.end_date}</td>
                    <td className="py-2 pr-3 uppercase">{reconciliation.status}</td>
                    <td className="py-2 pr-3">
                      <button
                        onClick={() =>
                          handleNavigate(getCompanyReconciliationDetailPath(activeCompany.slug, reconciliation.id))
                        }
                        className="rounded border border-zinc-300 px-2 py-1 text-xs"
                      >
                        Open
                      </button>
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
