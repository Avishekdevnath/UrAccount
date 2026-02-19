"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { ApiError, createAccount, fetchAccounts } from "@/lib/api-client";
import type { Account } from "@/lib/api-types";
import { useCompanyContext } from "@/lib/use-company-context";

export default function ChartOfAccountsPage() {
  const params = useParams<{ companySlug: string }>();
  const companySlug = params.companySlug;
  const { isLoading, error, user, companies, activeCompany, access, handleNavigate, handleLogout } =
    useCompanyContext(companySlug);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({
    code: "",
    name: "",
    type: "asset" as Account["type"],
    normal_balance: "debit" as Account["normal_balance"],
  });

  const canPost = !!access?.permissions.includes("accounting.post");

  async function loadAccounts(companyId: string) {
    setLoadingAccounts(true);
    try {
      const data = await fetchAccounts(companyId);
      setAccounts(data);
    } finally {
      setLoadingAccounts(false);
    }
  }

  useEffect(() => {
    if (!activeCompany) {
      return;
    }
    void loadAccounts(activeCompany.id);
  }, [activeCompany]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeCompany || !canPost) {
      return;
    }
    setFormError("");
    try {
      await createAccount(activeCompany.id, { ...form, is_active: true });
      setForm({ code: "", name: "", type: "asset", normal_balance: "debit" });
      await loadAccounts(activeCompany.id);
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
        <h2 className="text-lg font-medium text-zinc-900">Chart of Accounts</h2>
        <p className="mt-1 text-sm text-zinc-600">Manage account structure for this company.</p>

        <form className="mt-4 grid gap-3 md:grid-cols-5" onSubmit={handleCreate}>
          <input
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            placeholder="Code"
            value={form.code}
            onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))}
            required
          />
          <input
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm md:col-span-2"
            placeholder="Name"
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            required
          />
          <select
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            value={form.type}
            onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value as Account["type"] }))}
          >
            <option value="asset">Asset</option>
            <option value="liability">Liability</option>
            <option value="equity">Equity</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
          <select
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            value={form.normal_balance}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, normal_balance: event.target.value as Account["normal_balance"] }))
            }
          >
            <option value="debit">Debit</option>
            <option value="credit">Credit</option>
          </select>
          <button
            type="submit"
            disabled={!canPost}
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-45 md:col-span-5 md:w-fit"
          >
            Create Account
          </button>
        </form>
        {formError ? <p className="mt-2 text-sm text-red-600">{formError}</p> : null}

        <div className="mt-6 overflow-x-auto">
          {loadingAccounts ? (
            <p className="text-sm text-zinc-600">Loading accounts...</p>
          ) : (
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-600">
                  <th className="py-2 pr-3">Code</th>
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Normal</th>
                  <th className="py-2 pr-3">Active</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => (
                  <tr key={account.id} className="border-b border-zinc-100">
                    <td className="py-2 pr-3 font-mono">{account.code}</td>
                    <td className="py-2 pr-3">{account.name}</td>
                    <td className="py-2 pr-3">{account.type}</td>
                    <td className="py-2 pr-3">{account.normal_balance}</td>
                    <td className="py-2 pr-3">{account.is_active ? "Yes" : "No"}</td>
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
