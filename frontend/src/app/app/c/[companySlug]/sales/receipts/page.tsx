"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import {
  ApiError,
  createReceipt,
  fetchAccounts,
  fetchContacts,
  fetchInvoices,
  fetchReceipts,
  postReceipt,
  replaceReceiptAllocations,
  voidReceipt,
} from "@/lib/api-client";
import type { Account, Contact, Invoice, Receipt } from "@/lib/api-types";
import { getCompanyReceiptDetailPath } from "@/lib/company-routing";
import { generateIdempotencyKey } from "@/lib/idempotency";
import { useCompanyContext } from "@/lib/use-company-context";

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function ReceiptsPage() {
  const params = useParams<{ companySlug: string }>();
  const companySlug = params.companySlug;
  const { isLoading, error, user, companies, activeCompany, access, handleNavigate, handleLogout } =
    useCompanyContext(companySlug);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [customers, setCustomers] = useState<Contact[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");
  const [form, setForm] = useState({
    customer: "",
    received_date: new Date().toISOString().slice(0, 10),
    amount: "100.00",
    deposit_account: "",
    allocation_invoice_id: "",
    allocation_amount: "100.00",
    notes: "",
    post_now: true,
  });

  const canPost = !!access?.permissions.includes("accounting.post");
  const customerNameById = useMemo(() => {
    return Object.fromEntries(customers.map((customer) => [customer.id, customer.name]));
  }, [customers]);

  const openInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      if (!["posted", "partially_paid"].includes(invoice.status)) {
        return false;
      }
      return toNumber(invoice.total) > toNumber(invoice.amount_paid);
    });
  }, [invoices]);

  const loadData = useCallback(async (companyId: string) => {
    setLoadingData(true);
    try {
      const [accountData, customerData, invoiceData, receiptData] = await Promise.all([
        fetchAccounts(companyId),
        fetchContacts(companyId, { type: "customer" }),
        fetchInvoices(companyId),
        fetchReceipts(companyId),
      ]);
      setAccounts(accountData);
      setCustomers(customerData);
      setInvoices(invoiceData);
      setReceipts(receiptData);
      setForm((prev) => ({
        ...prev,
        deposit_account: prev.deposit_account || accountData[0]?.id || "",
        customer: prev.customer || customerData[0]?.id || "",
        allocation_invoice_id: prev.allocation_invoice_id || invoiceData[0]?.id || "",
      }));
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (!activeCompany) {
      return;
    }
    void loadData(activeCompany.id);
  }, [activeCompany, loadData]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeCompany || !canPost) {
      return;
    }
    setFormError("");
    if (!form.allocation_invoice_id) {
      setFormError("Select an invoice allocation.");
      return;
    }
    try {
      const created = await createReceipt(
        activeCompany.id,
        {
          customer: form.customer,
          received_date: form.received_date,
          amount: form.amount,
          currency_code: "USD",
          deposit_account: form.deposit_account,
          notes: form.notes || undefined,
        },
        generateIdempotencyKey("receipt-create")
      );
      await replaceReceiptAllocations(activeCompany.id, created.id, [
        {
          invoice_id: form.allocation_invoice_id,
          amount: form.allocation_amount,
        },
      ]);
      if (form.post_now) {
        await postReceipt(activeCompany.id, created.id, generateIdempotencyKey("receipt-post"));
      }
      await loadData(activeCompany.id);
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(`Create failed (${err.status}).`);
      } else {
        setFormError("Create failed.");
      }
    }
  }

  async function handlePost(receiptId: string) {
    if (!activeCompany || !canPost) {
      return;
    }
    setActionError("");
    try {
      await postReceipt(activeCompany.id, receiptId, generateIdempotencyKey("receipt-post"));
      await loadData(activeCompany.id);
    } catch (err) {
      if (err instanceof ApiError) {
        setActionError(`Post failed (${err.status}).`);
      } else {
        setActionError("Post failed.");
      }
    }
  }

  async function handleVoid(receiptId: string) {
    if (!activeCompany || !canPost) {
      return;
    }
    setActionError("");
    try {
      await voidReceipt(activeCompany.id, receiptId);
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
        <h2 className="text-lg font-medium text-zinc-900">Receipts</h2>
        <p className="mt-1 text-sm text-zinc-600">Capture customer payments and allocate to open invoices.</p>

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
            value={form.received_date}
            onChange={(event) => setForm((prev) => ({ ...prev, received_date: event.target.value }))}
            required
          />
          <input
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            placeholder="Amount"
            value={form.amount}
            onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
            required
          />
          <select
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            value={form.deposit_account}
            onChange={(event) => setForm((prev) => ({ ...prev, deposit_account: event.target.value }))}
            required
          >
            <option value="">Deposit account</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.code} - {account.name}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            value={form.allocation_invoice_id}
            onChange={(event) => setForm((prev) => ({ ...prev, allocation_invoice_id: event.target.value }))}
            required
          >
            <option value="">Allocate invoice</option>
            {openInvoices.map((invoice) => (
              <option key={invoice.id} value={invoice.id}>
                #{invoice.invoice_no ?? "draft"} - {customerNameById[invoice.customer] || invoice.customer}
              </option>
            ))}
          </select>
          <input
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            placeholder="Allocation amount"
            value={form.allocation_amount}
            onChange={(event) => setForm((prev) => ({ ...prev, allocation_amount: event.target.value }))}
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
            Create Receipt
          </button>
        </form>
        {formError ? <p className="mt-2 text-sm text-red-600">{formError}</p> : null}
        {actionError ? <p className="mt-2 text-sm text-red-600">{actionError}</p> : null}

        <div className="mt-6 overflow-x-auto">
          {loadingData ? (
            <p className="text-sm text-zinc-600">Loading receipts...</p>
          ) : (
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-600">
                  <th className="py-2 pr-3">Receipt #</th>
                  <th className="py-2 pr-3">Customer</th>
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Amount</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {receipts.map((receipt) => (
                  <tr key={receipt.id} className="border-b border-zinc-100">
                    <td className="py-2 pr-3">{receipt.receipt_no ?? "-"}</td>
                    <td className="py-2 pr-3">{customerNameById[receipt.customer] || receipt.customer}</td>
                    <td className="py-2 pr-3">{receipt.received_date}</td>
                    <td className="py-2 pr-3">{receipt.amount}</td>
                    <td className="py-2 pr-3 uppercase">{receipt.status}</td>
                    <td className="py-2 pr-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            handleNavigate(getCompanyReceiptDetailPath(activeCompany.slug, receipt.id))
                          }
                          className="rounded border border-zinc-300 px-2 py-1 text-xs"
                        >
                          Open
                        </button>
                        <button
                          disabled={!canPost || receipt.status !== "draft"}
                          onClick={() => handlePost(receipt.id)}
                          className="rounded border border-zinc-300 px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          Post
                        </button>
                        <button
                          disabled={!canPost || receipt.status !== "posted"}
                          onClick={() => handleVoid(receipt.id)}
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
