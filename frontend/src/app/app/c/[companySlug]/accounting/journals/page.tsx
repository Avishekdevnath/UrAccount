"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import {
  ApiError,
  createJournal,
  fetchAccounts,
  fetchJournals,
  postJournal,
  replaceJournalLines,
  voidJournal,
} from "@/lib/api-client";
import type { Account, JournalEntry } from "@/lib/api-types";
import { useCompanyContext } from "@/lib/use-company-context";

export default function JournalsPage() {
  const params = useParams<{ companySlug: string }>();
  const companySlug = params.companySlug;
  const { isLoading, error, user, companies, activeCompany, access, handleNavigate, handleLogout } =
    useCompanyContext(companySlug);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");
  const [form, setForm] = useState({
    entry_date: new Date().toISOString().slice(0, 10),
    description: "",
    debit_account_id: "",
    credit_account_id: "",
    amount: "100.00",
    post_now: true,
  });

  const canPost = !!access?.permissions.includes("accounting.post");

  async function loadData(companyId: string) {
    setLoadingData(true);
    try {
      const [acct, je] = await Promise.all([fetchAccounts(companyId), fetchJournals(companyId)]);
      setAccounts(acct);
      setJournals(je);
    } finally {
      setLoadingData(false);
    }
  }

  useEffect(() => {
    if (!activeCompany) {
      return;
    }
    void loadData(activeCompany.id);
  }, [activeCompany]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeCompany || !canPost) {
      return;
    }
    setFormError("");
    try {
      const draft = await createJournal(activeCompany.id, {
        entry_date: form.entry_date,
        description: form.description || "Manual Journal",
      });
      await replaceJournalLines(activeCompany.id, draft.id, [
        {
          account_id: form.debit_account_id,
          debit: form.amount,
          credit: "0.00",
          description: "Debit line",
        },
        {
          account_id: form.credit_account_id,
          debit: "0.00",
          credit: form.amount,
          description: "Credit line",
        },
      ]);
      if (form.post_now) {
        await postJournal(activeCompany.id, draft.id);
      }
      await loadData(activeCompany.id);
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(`Create journal failed (${err.status}).`);
      } else {
        setFormError("Create journal failed.");
      }
    }
  }

  async function handlePost(journalId: string) {
    if (!activeCompany || !canPost) {
      return;
    }
    setActionError("");
    try {
      await postJournal(activeCompany.id, journalId);
      await loadData(activeCompany.id);
    } catch (err) {
      if (err instanceof ApiError) {
        setActionError(`Post failed (${err.status}).`);
      } else {
        setActionError("Post failed.");
      }
    }
  }

  async function handleVoid(journalId: string) {
    if (!activeCompany || !canPost) {
      return;
    }
    setActionError("");
    try {
      await voidJournal(activeCompany.id, journalId);
      await loadData(activeCompany.id);
    } catch (err) {
      if (err instanceof ApiError) {
        setActionError(`Void failed (${err.status}).`);
      } else {
        setActionError("Void failed.");
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
        <h2 className="text-lg font-medium text-zinc-900">Journals</h2>
        <p className="mt-1 text-sm text-zinc-600">Create journal entries, post drafts, and void posted entries.</p>

        <form className="mt-4 grid gap-3 md:grid-cols-3" onSubmit={handleCreate}>
          <input
            type="date"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            value={form.entry_date}
            onChange={(event) => setForm((prev) => ({ ...prev, entry_date: event.target.value }))}
            required
          />
          <input
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm md:col-span-2"
            placeholder="Description"
            value={form.description}
            onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
          />
          <select
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            value={form.debit_account_id}
            onChange={(event) => setForm((prev) => ({ ...prev, debit_account_id: event.target.value }))}
            required
          >
            <option value="">Debit account</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.code} - {account.name}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            value={form.credit_account_id}
            onChange={(event) => setForm((prev) => ({ ...prev, credit_account_id: event.target.value }))}
            required
          >
            <option value="">Credit account</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.code} - {account.name}
              </option>
            ))}
          </select>
          <input
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            placeholder="Amount"
            value={form.amount}
            onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
            required
          />
          <label className="flex items-center gap-2 text-sm text-zinc-700 md:col-span-3">
            <input
              type="checkbox"
              checked={form.post_now}
              onChange={(event) => setForm((prev) => ({ ...prev, post_now: event.target.checked }))}
            />
            Post immediately
          </label>
          <button
            type="submit"
            disabled={!canPost}
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-45 md:col-span-3 md:w-fit"
          >
            Create Journal
          </button>
        </form>
        {formError ? <p className="mt-2 text-sm text-red-600">{formError}</p> : null}
        {actionError ? <p className="mt-2 text-sm text-red-600">{actionError}</p> : null}

        <div className="mt-6 overflow-x-auto">
          {loadingData ? (
            <p className="text-sm text-zinc-600">Loading journals...</p>
          ) : (
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-600">
                  <th className="py-2 pr-3">Entry #</th>
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Description</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {journals.map((journal) => (
                  <tr key={journal.id} className="border-b border-zinc-100">
                    <td className="py-2 pr-3">{journal.entry_no ?? "-"}</td>
                    <td className="py-2 pr-3">{journal.entry_date}</td>
                    <td className="py-2 pr-3">{journal.description || "-"}</td>
                    <td className="py-2 pr-3 uppercase">{journal.status}</td>
                    <td className="py-2 pr-3">
                      <div className="flex gap-2">
                        <button
                          disabled={!canPost || journal.status !== "draft"}
                          onClick={() => handlePost(journal.id)}
                          className="rounded border border-zinc-300 px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          Post
                        </button>
                        <button
                          disabled={!canPost || journal.status !== "posted"}
                          onClick={() => handleVoid(journal.id)}
                          className="rounded border border-zinc-300 px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          Void
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
