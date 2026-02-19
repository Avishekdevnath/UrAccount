"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { ApiError, createBankAccount, deleteBankAccount, fetchAccounts, fetchBankAccounts } from "@/lib/api-client";
import type { Account, BankAccount } from "@/lib/api-types";
import { useCompanyContext } from "@/lib/use-company-context";

export default function BankingAccountsPage() {
  const params = useParams<{ companySlug: string }>();
  const companySlug = params.companySlug;
  const { isLoading, error, user, companies, activeCompany, access, handleNavigate, handleLogout } =
    useCompanyContext(companySlug);

  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");
  const [form, setForm] = useState({
    name: "",
    account_number_last4: "",
    currency_code: "USD",
    ledger_account: "",
    is_active: true,
  });

  const canPost = !!access?.permissions.includes("accounting.post");

  async function loadData(companyId: string) {
    setLoadingData(true);
    try {
      const [bankAccountData, ledgerAccounts] = await Promise.all([fetchBankAccounts(companyId), fetchAccounts(companyId)]);
      setBankAccounts(bankAccountData);
      setAccounts(ledgerAccounts);
      setForm((prev) => ({
        ...prev,
        ledger_account: prev.ledger_account || ledgerAccounts[0]?.id || "",
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
      await createBankAccount(activeCompany.id, form);
      setForm((prev) => ({ ...prev, name: "", account_number_last4: "" }));
      await loadData(activeCompany.id);
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(`Create failed (${err.status}).`);
      } else {
        setFormError("Create failed.");
      }
    }
  }

  async function handleDelete(bankAccountId: string) {
    if (!activeCompany || !canPost) {
      return;
    }
    if (!window.confirm("Delete this bank account?")) {
      return;
    }
    setActionError("");
    try {
      await deleteBankAccount(activeCompany.id, bankAccountId);
      await loadData(activeCompany.id);
    } catch (err) {
      if (err instanceof ApiError) {
        setActionError((err.payload as { detail?: string })?.detail || `Delete failed (${err.status}).`);
      } else {
        setActionError("Delete failed.");
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
        <h2 className="text-lg font-medium text-zinc-900">Bank Accounts</h2>
        <p className="mt-1 text-sm text-zinc-600">Manage company bank accounts linked to ledger accounts.</p>

        <form className="mt-4 grid gap-3 md:grid-cols-5" onSubmit={handleCreate}>
          <input
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            placeholder="Name"
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            required
          />
          <input
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            placeholder="Last 4"
            maxLength={4}
            value={form.account_number_last4}
            onChange={(event) => setForm((prev) => ({ ...prev, account_number_last4: event.target.value }))}
          />
          <input
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            placeholder="Currency"
            maxLength={3}
            value={form.currency_code}
            onChange={(event) => setForm((prev) => ({ ...prev, currency_code: event.target.value }))}
          />
          <select
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            value={form.ledger_account}
            onChange={(event) => setForm((prev) => ({ ...prev, ledger_account: event.target.value }))}
            required
          >
            <option value="">Ledger account</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.code} - {account.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={!canPost}
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-45"
          >
            Add
          </button>
        </form>
        {formError ? <p className="mt-2 text-sm text-red-600">{formError}</p> : null}
        {actionError ? <p className="mt-2 text-sm text-red-600">{actionError}</p> : null}

        <div className="mt-6 overflow-x-auto">
          {loadingData ? (
            <p className="text-sm text-zinc-600">Loading bank accounts...</p>
          ) : (
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-600">
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Last 4</th>
                  <th className="py-2 pr-3">Currency</th>
                  <th className="py-2 pr-3">Ledger Account</th>
                  <th className="py-2 pr-3">Active</th>
                  <th className="py-2 pr-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {bankAccounts.map((bankAccount) => (
                  <tr key={bankAccount.id} className="border-b border-zinc-100">
                    <td className="py-2 pr-3">{bankAccount.name}</td>
                    <td className="py-2 pr-3">{bankAccount.account_number_last4 || "-"}</td>
                    <td className="py-2 pr-3">{bankAccount.currency_code}</td>
                    <td className="py-2 pr-3">{bankAccount.ledger_account}</td>
                    <td className="py-2 pr-3">{bankAccount.is_active ? "Yes" : "No"}</td>
                    <td className="py-2 pr-3">
                      <button
                        type="button"
                        disabled={!canPost}
                        onClick={() => void handleDelete(bankAccount.id)}
                        className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        Delete
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
