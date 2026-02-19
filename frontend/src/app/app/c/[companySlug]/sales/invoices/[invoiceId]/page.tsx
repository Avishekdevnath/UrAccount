"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import {
  ApiError,
  fetchAccounts,
  fetchContacts,
  fetchInvoice,
  postInvoice,
  replaceInvoiceLines,
  updateInvoice,
  voidInvoice,
} from "@/lib/api-client";
import type { Account, Contact, Invoice } from "@/lib/api-types";
import { getCompanyInvoicesPath } from "@/lib/company-routing";
import { useCompanyContext } from "@/lib/use-company-context";

type InvoiceLineDraft = {
  localId: string;
  description: string;
  quantity: string;
  unit_price: string;
  revenue_account_id: string;
};

function newLineDraft(accounts: Account[]): InvoiceLineDraft {
  return {
    localId: Math.random().toString(36).slice(2, 10),
    description: "",
    quantity: "1",
    unit_price: "0.00",
    revenue_account_id: accounts[0]?.id || "",
  };
}

export default function InvoiceDetailPage() {
  const params = useParams<{ companySlug: string; invoiceId: string }>();
  const companySlug = params.companySlug;
  const invoiceId = params.invoiceId;
  const { isLoading, error, user, companies, activeCompany, access, handleNavigate, handleLogout } =
    useCompanyContext(companySlug);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [customers, setCustomers] = useState<Contact[]>([]);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loadingPage, setLoadingPage] = useState(false);
  const [headerForm, setHeaderForm] = useState({
    customer: "",
    issue_date: "",
    due_date: "",
    currency_code: "USD",
    ar_account: "",
    notes: "",
  });
  const [lineDrafts, setLineDrafts] = useState<InvoiceLineDraft[]>([]);
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");

  const canPost = !!access?.permissions.includes("accounting.post");
  const canEditDraft = !!(canPost && invoice?.status === "draft");

  const loadDetail = useCallback(async (companyId: string) => {
    setLoadingPage(true);
    try {
      const [invoiceData, accountData, customerData] = await Promise.all([
        fetchInvoice(companyId, invoiceId),
        fetchAccounts(companyId),
        fetchContacts(companyId, { type: "customer" }),
      ]);
      setInvoice(invoiceData);
      setAccounts(accountData);
      setCustomers(customerData);
      setHeaderForm({
        customer: invoiceData.customer,
        issue_date: invoiceData.issue_date,
        due_date: invoiceData.due_date || "",
        currency_code: invoiceData.currency_code,
        ar_account: invoiceData.ar_account,
        notes: invoiceData.notes || "",
      });
      setLineDrafts(
        invoiceData.lines.map((line) => ({
          localId: line.id,
          description: line.description,
          quantity: line.quantity,
          unit_price: line.unit_price,
          revenue_account_id: line.revenue_account,
        }))
      );
    } finally {
      setLoadingPage(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    if (!activeCompany) {
      return;
    }
    void loadDetail(activeCompany.id);
  }, [activeCompany, loadDetail]);

  async function handleHeaderSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeCompany || !invoice || !canEditDraft) {
      return;
    }
    setFormError("");
    setInfoMessage("");
    try {
      await updateInvoice(activeCompany.id, invoice.id, {
        customer: headerForm.customer,
        issue_date: headerForm.issue_date,
        due_date: headerForm.due_date || undefined,
        currency_code: headerForm.currency_code || "USD",
        notes: headerForm.notes || undefined,
        ar_account: headerForm.ar_account,
      });
      await loadDetail(activeCompany.id);
      setInfoMessage("Invoice header saved.");
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(`Save failed (${err.status}).`);
      } else {
        setFormError("Save failed.");
      }
    }
  }

  async function handleLinesSave() {
    if (!activeCompany || !invoice || !canEditDraft) {
      return;
    }
    setFormError("");
    setInfoMessage("");
    if (!lineDrafts.length) {
      setFormError("At least one invoice line is required.");
      return;
    }
    try {
      await replaceInvoiceLines(
        activeCompany.id,
        invoice.id,
        lineDrafts.map((line, idx) => ({
          line_no: idx + 1,
          description: line.description,
          quantity: line.quantity,
          unit_price: line.unit_price,
          revenue_account_id: line.revenue_account_id,
        }))
      );
      await loadDetail(activeCompany.id);
      setInfoMessage("Invoice lines saved.");
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(`Save lines failed (${err.status}).`);
      } else {
        setFormError("Save lines failed.");
      }
    }
  }

  async function handlePost() {
    if (!activeCompany || !invoice || !canPost) {
      return;
    }
    setActionError("");
    setInfoMessage("");
    try {
      await postInvoice(activeCompany.id, invoice.id);
      await loadDetail(activeCompany.id);
      setInfoMessage("Invoice posted.");
    } catch (err) {
      if (err instanceof ApiError) {
        setActionError(`Post failed (${err.status}).`);
      } else {
        setActionError("Post failed.");
      }
    }
  }

  async function handleVoid() {
    if (!activeCompany || !invoice || !canPost) {
      return;
    }
    setActionError("");
    setInfoMessage("");
    try {
      await voidInvoice(activeCompany.id, invoice.id);
      await loadDetail(activeCompany.id);
      setInfoMessage("Invoice voided.");
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-medium text-zinc-900">Invoice Detail</h2>
            <p className="mt-1 text-sm text-zinc-600">
              #{invoice?.invoice_no ?? "-"} | Status: {invoice?.status?.toUpperCase() || "-"}
            </p>
          </div>
          <button
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
            onClick={() => handleNavigate(getCompanyInvoicesPath(activeCompany.slug))}
          >
            Back to Invoices
          </button>
        </div>

        {loadingPage || !invoice ? (
          <p className="mt-4 text-sm text-zinc-600">Loading invoice detail...</p>
        ) : (
          <>
            <form className="mt-4 grid gap-3 md:grid-cols-3" onSubmit={handleHeaderSave}>
              <select
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
                value={headerForm.customer}
                onChange={(event) => setHeaderForm((prev) => ({ ...prev, customer: event.target.value }))}
                disabled={!canEditDraft}
                required
              >
                <option value="">Select customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
              <input
                type="date"
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
                value={headerForm.issue_date}
                onChange={(event) => setHeaderForm((prev) => ({ ...prev, issue_date: event.target.value }))}
                disabled={!canEditDraft}
                required
              />
              <input
                type="date"
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
                value={headerForm.due_date}
                onChange={(event) => setHeaderForm((prev) => ({ ...prev, due_date: event.target.value }))}
                disabled={!canEditDraft}
              />
              <input
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
                value={headerForm.currency_code}
                onChange={(event) => setHeaderForm((prev) => ({ ...prev, currency_code: event.target.value }))}
                disabled={!canEditDraft}
                maxLength={3}
              />
              <select
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
                value={headerForm.ar_account}
                onChange={(event) => setHeaderForm((prev) => ({ ...prev, ar_account: event.target.value }))}
                disabled={!canEditDraft}
                required
              >
                <option value="">AR account</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.code} - {account.name}
                  </option>
                ))}
              </select>
              <input
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm md:col-span-3"
                value={headerForm.notes}
                onChange={(event) => setHeaderForm((prev) => ({ ...prev, notes: event.target.value }))}
                disabled={!canEditDraft}
                placeholder="Notes"
              />
              <button
                type="submit"
                disabled={!canEditDraft}
                className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-45 md:w-fit"
              >
                Save Header
              </button>
            </form>

            <div className="mt-4 rounded-md border border-zinc-200 p-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-medium text-zinc-900">Invoice Lines</h3>
                <div className="flex gap-2">
                  <button
                    className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 disabled:opacity-45"
                    onClick={() => setLineDrafts((prev) => [...prev, newLineDraft(accounts)])}
                    disabled={!canEditDraft}
                  >
                    Add Line
                  </button>
                  <button
                    className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 disabled:opacity-45"
                    onClick={handleLinesSave}
                    disabled={!canEditDraft}
                  >
                    Save Lines
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {lineDrafts.map((line, idx) => (
                  <div key={line.localId} className="grid gap-2 md:grid-cols-5">
                    <input
                      className="rounded-md border border-zinc-300 px-2 py-1 text-sm"
                      value={line.description}
                      onChange={(event) =>
                        setLineDrafts((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, description: event.target.value } : item))
                        )
                      }
                      disabled={!canEditDraft}
                      placeholder="Description"
                    />
                    <input
                      className="rounded-md border border-zinc-300 px-2 py-1 text-sm"
                      value={line.quantity}
                      onChange={(event) =>
                        setLineDrafts((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, quantity: event.target.value } : item))
                        )
                      }
                      disabled={!canEditDraft}
                      placeholder="Qty"
                    />
                    <input
                      className="rounded-md border border-zinc-300 px-2 py-1 text-sm"
                      value={line.unit_price}
                      onChange={(event) =>
                        setLineDrafts((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, unit_price: event.target.value } : item))
                        )
                      }
                      disabled={!canEditDraft}
                      placeholder="Unit price"
                    />
                    <select
                      className="rounded-md border border-zinc-300 px-2 py-1 text-sm"
                      value={line.revenue_account_id}
                      onChange={(event) =>
                        setLineDrafts((prev) =>
                          prev.map((item, i) =>
                            i === idx ? { ...item, revenue_account_id: event.target.value } : item
                          )
                        )
                      }
                      disabled={!canEditDraft}
                    >
                      <option value="">Revenue account</option>
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.code} - {account.name}
                        </option>
                      ))}
                    </select>
                    <button
                      className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 disabled:opacity-45"
                      onClick={() => setLineDrafts((prev) => prev.filter((_, i) => i !== idx))}
                      disabled={!canEditDraft}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                disabled={!canPost || invoice.status !== "draft"}
                onClick={handlePost}
                className="rounded border border-zinc-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-45"
              >
                Post Invoice
              </button>
              <button
                disabled={!canPost || !["posted", "partially_paid"].includes(invoice.status)}
                onClick={handleVoid}
                className="rounded border border-zinc-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-45"
              >
                Void Invoice
              </button>
            </div>
          </>
        )}

        {formError ? <p className="mt-3 text-sm text-red-600">{formError}</p> : null}
        {actionError ? <p className="mt-3 text-sm text-red-600">{actionError}</p> : null}
        {infoMessage ? <p className="mt-3 text-sm text-green-700">{infoMessage}</p> : null}
      </div>
    </AppShell>
  );
}
