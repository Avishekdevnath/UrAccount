"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { ApiError, createBankImport, fetchBankAccounts, fetchBankImports } from "@/lib/api-client";
import type { BankAccount, BankStatementImport } from "@/lib/api-types";
import { useCompanyContext } from "@/lib/use-company-context";

export default function BankingImportsPage() {
  const params = useParams<{ companySlug: string }>();
  const companySlug = params.companySlug;
  const { isLoading, error, user, companies, activeCompany, access, handleNavigate, handleLogout } =
    useCompanyContext(companySlug);

  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [imports, setImports] = useState<BankStatementImport[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({
    bank_account: "",
    file_name: "statement.csv",
    raw_content: "date,description,amount,reference\n2026-02-20,Deposit,50.00,REF1",
  });

  const canPost = !!access?.permissions.includes("accounting.post");

  async function loadData(companyId: string) {
    setLoadingData(true);
    try {
      const [bankAccountData, importData] = await Promise.all([fetchBankAccounts(companyId), fetchBankImports(companyId)]);
      setBankAccounts(bankAccountData);
      setImports(importData);
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
      await createBankImport(activeCompany.id, form);
      await loadData(activeCompany.id);
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(`Import failed (${err.status}).`);
      } else {
        setFormError("Import failed.");
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
        <h2 className="text-lg font-medium text-zinc-900">Bank Imports</h2>
        <p className="mt-1 text-sm text-zinc-600">Upload statement CSV content for parsing into bank transactions.</p>

        <form className="mt-4 grid gap-3" onSubmit={handleCreate}>
          <div className="grid gap-3 md:grid-cols-2">
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
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={form.file_name}
              onChange={(event) => setForm((prev) => ({ ...prev, file_name: event.target.value }))}
              placeholder="File name"
              required
            />
          </div>
          <textarea
            className="min-h-40 rounded-md border border-zinc-300 px-3 py-2 text-sm"
            value={form.raw_content}
            onChange={(event) => setForm((prev) => ({ ...prev, raw_content: event.target.value }))}
            placeholder="CSV content"
            required
          />
          <button
            type="submit"
            disabled={!canPost}
            className="w-fit rounded-md bg-zinc-900 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-45"
          >
            Parse Import
          </button>
        </form>
        {formError ? <p className="mt-2 text-sm text-red-600">{formError}</p> : null}

        <div className="mt-6 overflow-x-auto">
          {loadingData ? (
            <p className="text-sm text-zinc-600">Loading imports...</p>
          ) : (
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-600">
                  <th className="py-2 pr-3">File</th>
                  <th className="py-2 pr-3">Bank Account</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Error</th>
                  <th className="py-2 pr-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {imports.map((statementImport) => (
                  <tr key={statementImport.id} className="border-b border-zinc-100">
                    <td className="py-2 pr-3">{statementImport.file_name}</td>
                    <td className="py-2 pr-3">{statementImport.bank_account}</td>
                    <td className="py-2 pr-3 uppercase">{statementImport.status}</td>
                    <td className="py-2 pr-3">{statementImport.error_message || "-"}</td>
                    <td className="py-2 pr-3">{statementImport.created_at}</td>
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
