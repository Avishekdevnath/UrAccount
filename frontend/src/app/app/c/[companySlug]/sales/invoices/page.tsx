"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import {
  ApiError,
  createInvoice,
  fetchAccounts,
  fetchContacts,
  fetchInvoices,
  postInvoice,
  replaceInvoiceLines,
  voidInvoice,
} from "@/lib/api-client";
import type { Account, Contact, Invoice } from "@/lib/api-types";
import { getCompanyInvoiceDetailPath } from "@/lib/company-routing";
import { useCompanyContext } from "@/lib/use-company-context";

export default function InvoicesPage() {
  const params = useParams<{ companySlug: string }>();
  const companySlug = params.companySlug;
  const { isLoading, error, user, companies, activeCompany, access, handleNavigate, handleLogout } =
    useCompanyContext(companySlug);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [customers, setCustomers] = useState<Contact[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [loadingData, setLoadingData] = useState(false);
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");
  const [form, setForm] = useState({
    customer: "",
    issue_date: new Date().toISOString().slice(0, 10),
    due_date: new Date().toISOString().slice(0, 10),
    ar_account: "",
    revenue_account_id: "",
    line_description: "Service fee",
    quantity: "1",
    unit_price: "100.00",
    notes: "",
    post_now: true,
  });

  const canPost = !!access?.permissions.includes("accounting.post");
  const customerNameById = useMemo(() => {
    return Object.fromEntries(customers.map((customer) => [customer.id, customer.name]));
  }, [customers]);

  const loadData = useCallback(async (companyId: string, status: string) => {
    setLoadingData(true);
    try {
      const [accountData, customerData, invoiceData] = await Promise.all([
        fetchAccounts(companyId),
        fetchContacts(companyId, { type: "customer" }),
        fetchInvoices(companyId, status === "all" ? undefined : status),
      ]);
      setAccounts(accountData);
      setCustomers(customerData);
      setInvoices(invoiceData);
      setForm((prev) => ({
        ...prev,
        ar_account: prev.ar_account || accountData[0]?.id || "",
        revenue_account_id: prev.revenue_account_id || accountData[0]?.id || "",
        customer: prev.customer || customerData[0]?.id || "",
      }));
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (!activeCompany) {
      return;
    }
    void loadData(activeCompany.id, statusFilter);
  }, [activeCompany, loadData, statusFilter]);

  async function handleRefreshFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeCompany) {
      return;
    }
    await loadData(activeCompany.id, statusFilter);
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeCompany || !canPost) {
      return;
    }
    setFormError("");
    try {
      const invoice = await createInvoice(activeCompany.id, {
        customer: form.customer,
        issue_date: form.issue_date,
        due_date: form.due_date || undefined,
        currency_code: "USD",
        notes: form.notes || undefined,
        ar_account: form.ar_account,
      });
      await replaceInvoiceLines(activeCompany.id, invoice.id, [
        {
          description: form.line_description,
          quantity: form.quantity,
          unit_price: form.unit_price,
          revenue_account_id: form.revenue_account_id,
        },
      ]);
      if (form.post_now) {
        await postInvoice(activeCompany.id, invoice.id);
      }
      await loadData(activeCompany.id, statusFilter);
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(`Create failed (${err.status}).`);
      } else {
        setFormError("Create failed.");
      }
    }
  }

  async function handlePost(invoiceId: string) {
    if (!activeCompany || !canPost) {
      return;
    }
    setActionError("");
    try {
      await postInvoice(activeCompany.id, invoiceId);
      await loadData(activeCompany.id, statusFilter);
    } catch (err) {
      if (err instanceof ApiError) {
        setActionError(`Post failed (${err.status}).`);
      } else {
        setActionError("Post failed.");
      }
    }
  }

  async function handleVoid(invoiceId: string) {
    if (!activeCompany || !canPost) {
      return;
    }
    setActionError("");
    try {
      await voidInvoice(activeCompany.id, invoiceId);
      await loadData(activeCompany.id, statusFilter);
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
        <h2 className="text-lg font-medium text-zinc-900">Invoices</h2>
        <p className="mt-1 text-sm text-zinc-600">Create invoice drafts, post, and void by status rules.</p>

        <form className="mt-4 flex flex-wrap items-end gap-2" onSubmit={handleRefreshFilter}>
          <div>
            <label className="mb-1 block text-xs text-zinc-600" htmlFor="invoice-status-filter">
              Status
            </label>
            <select
              id="invoice-status-filter"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">All</option>
              <option value="draft">Draft</option>
              <option value="posted">Posted</option>
              <option value="partially_paid">Partially Paid</option>
              <option value="paid">Paid</option>
              <option value="void">Void</option>
            </select>
          </div>
          <button className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50">
            Refresh
          </button>
        </form>

        <form className="mt-4 grid gap-3 md:grid-cols-3" onSubmit={handleCreate}>
          <select
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            value={form.customer}
            onChange={(event) => setForm((prev) => ({ ...prev, customer: event.target.value }))}
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
            value={form.issue_date}
            onChange={(event) => setForm((prev) => ({ ...prev, issue_date: event.target.value }))}
            required
          />
          <input
            type="date"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            value={form.due_date}
            onChange={(event) => setForm((prev) => ({ ...prev, due_date: event.target.value }))}
          />
          <select
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            value={form.ar_account}
            onChange={(event) => setForm((prev) => ({ ...prev, ar_account: event.target.value }))}
            required
          >
            <option value="">AR account</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.code} - {account.name}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            value={form.revenue_account_id}
            onChange={(event) => setForm((prev) => ({ ...prev, revenue_account_id: event.target.value }))}
            required
          >
            <option value="">Revenue account</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.code} - {account.name}
              </option>
            ))}
          </select>
          <input
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            placeholder="Line description"
            value={form.line_description}
            onChange={(event) => setForm((prev) => ({ ...prev, line_description: event.target.value }))}
            required
          />
          <input
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            placeholder="Quantity"
            value={form.quantity}
            onChange={(event) => setForm((prev) => ({ ...prev, quantity: event.target.value }))}
            required
          />
          <input
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            placeholder="Unit price"
            value={form.unit_price}
            onChange={(event) => setForm((prev) => ({ ...prev, unit_price: event.target.value }))}
            required
          />
          <input
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm md:col-span-3"
            placeholder="Notes"
            value={form.notes}
            onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
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
            Create Invoice
          </button>
        </form>
        {formError ? <p className="mt-2 text-sm text-red-600">{formError}</p> : null}
        {actionError ? <p className="mt-2 text-sm text-red-600">{actionError}</p> : null}

        <div className="mt-6 overflow-x-auto">
          {loadingData ? (
            <p className="text-sm text-zinc-600">Loading invoices...</p>
          ) : (
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-600">
                  <th className="py-2 pr-3">Invoice #</th>
                  <th className="py-2 pr-3">Customer</th>
                  <th className="py-2 pr-3">Issue</th>
                  <th className="py-2 pr-3">Total</th>
                  <th className="py-2 pr-3">Paid</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="border-b border-zinc-100">
                    <td className="py-2 pr-3">{invoice.invoice_no ?? "-"}</td>
                    <td className="py-2 pr-3">{customerNameById[invoice.customer] || invoice.customer}</td>
                    <td className="py-2 pr-3">{invoice.issue_date}</td>
                    <td className="py-2 pr-3">{invoice.total}</td>
                    <td className="py-2 pr-3">{invoice.amount_paid}</td>
                    <td className="py-2 pr-3 uppercase">{invoice.status}</td>
                    <td className="py-2 pr-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            handleNavigate(getCompanyInvoiceDetailPath(activeCompany.slug, invoice.id))
                          }
                          className="rounded border border-zinc-300 px-2 py-1 text-xs"
                        >
                          Open
                        </button>
                        <button
                          disabled={!canPost || invoice.status !== "draft"}
                          onClick={() => handlePost(invoice.id)}
                          className="rounded border border-zinc-300 px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          Post
                        </button>
                        <button
                          disabled={!canPost || !["posted", "partially_paid"].includes(invoice.status)}
                          onClick={() => handleVoid(invoice.id)}
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
