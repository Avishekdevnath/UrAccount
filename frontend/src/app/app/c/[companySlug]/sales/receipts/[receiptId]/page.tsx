"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Printer } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import {
  ApiError,
  fetchAccounts,
  fetchContacts,
  fetchInvoices,
  fetchReceipt,
  postReceipt,
  replaceReceiptAllocations,
  updateReceipt,
  voidReceipt,
} from "@/lib/api-client";
import type { Account, Contact, Invoice, Receipt } from "@/lib/api-types";
import { getCompanyReceiptsPath } from "@/lib/company-routing";
import { generateIdempotencyKey } from "@/lib/idempotency";
import { printReceipt } from "@/lib/print/documents";
import { useCompanyContext } from "@/lib/use-company-context";

type AllocationDraft = {
  localId: string;
  invoice_id: string;
  amount: string;
};

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function newAllocationDraft(invoices: Invoice[]): AllocationDraft {
  return {
    localId: Math.random().toString(36).slice(2, 10),
    invoice_id: invoices[0]?.id || "",
    amount: "0.00",
  };
}

export default function ReceiptDetailPage() {
  const params = useParams<{ companySlug: string; receiptId: string }>();
  const companySlug = params.companySlug;
  const receiptId = params.receiptId;
  const { isLoading, error, user, companies, activeCompany, access, handleNavigate, handleLogout } =
    useCompanyContext(companySlug);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [customers, setCustomers] = useState<Contact[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loadingPage, setLoadingPage] = useState(false);
  const [headerForm, setHeaderForm] = useState({
    customer: "",
    received_date: "",
    amount: "0.00",
    currency_code: "USD",
    deposit_account: "",
    notes: "",
  });
  const [allocations, setAllocations] = useState<AllocationDraft[]>([]);
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");

  const canPost = !!access?.permissions.includes("accounting.post");
  const canEditDraft = !!(canPost && receipt?.status === "draft");

  const openInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      if (!["posted", "partially_paid"].includes(invoice.status)) {
        return false;
      }
      return toNumber(invoice.total) > toNumber(invoice.amount_paid);
    });
  }, [invoices]);

  const customerNameById = useMemo(() => {
    return Object.fromEntries(customers.map((customer) => [customer.id, customer.name]));
  }, [customers]);

  const loadDetail = useCallback(async (companyId: string) => {
    setLoadingPage(true);
    try {
      const [receiptData, accountData, customerData, invoiceData] = await Promise.all([
        fetchReceipt(companyId, receiptId),
        fetchAccounts(companyId),
        fetchContacts(companyId, { type: "customer" }),
        fetchInvoices(companyId),
      ]);
      setReceipt(receiptData);
      setAccounts(accountData);
      setCustomers(customerData);
      setInvoices(invoiceData);
      setHeaderForm({
        customer: receiptData.customer,
        received_date: receiptData.received_date,
        amount: receiptData.amount,
        currency_code: receiptData.currency_code,
        deposit_account: receiptData.deposit_account,
        notes: receiptData.notes || "",
      });
      setAllocations(
        receiptData.allocations.map((allocation) => ({
          localId: allocation.id,
          invoice_id: allocation.invoice,
          amount: allocation.amount,
        }))
      );
    } finally {
      setLoadingPage(false);
    }
  }, [receiptId]);

  useEffect(() => {
    if (!activeCompany) {
      return;
    }
    void loadDetail(activeCompany.id);
  }, [activeCompany, loadDetail]);

  async function handleHeaderSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeCompany || !receipt || !canEditDraft) {
      return;
    }
    setFormError("");
    setInfoMessage("");
    try {
      await updateReceipt(activeCompany.id, receipt.id, {
        customer: headerForm.customer,
        received_date: headerForm.received_date,
        amount: headerForm.amount,
        currency_code: headerForm.currency_code || "USD",
        deposit_account: headerForm.deposit_account,
        notes: headerForm.notes || undefined,
      });
      await loadDetail(activeCompany.id);
      setInfoMessage("Receipt header saved.");
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(`Save failed (${err.status}).`);
      } else {
        setFormError("Save failed.");
      }
    }
  }

  async function handleAllocationsSave() {
    if (!activeCompany || !receipt || !canEditDraft) {
      return;
    }
    setFormError("");
    setInfoMessage("");
    if (!allocations.length) {
      setFormError("At least one allocation is required.");
      return;
    }
    try {
      await replaceReceiptAllocations(
        activeCompany.id,
        receipt.id,
        allocations.map((allocation) => ({
          invoice_id: allocation.invoice_id,
          amount: allocation.amount,
        }))
      );
      await loadDetail(activeCompany.id);
      setInfoMessage("Receipt allocations saved.");
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(`Save allocations failed (${err.status}).`);
      } else {
        setFormError("Save allocations failed.");
      }
    }
  }

  async function handlePost() {
    if (!activeCompany || !receipt || !canPost) {
      return;
    }
    setActionError("");
    setInfoMessage("");
    try {
      await postReceipt(activeCompany.id, receipt.id, generateIdempotencyKey("receipt-post"));
      await loadDetail(activeCompany.id);
      setInfoMessage("Receipt posted.");
    } catch (err) {
      if (err instanceof ApiError) {
        setActionError(`Post failed (${err.status}).`);
      } else {
        setActionError("Post failed.");
      }
    }
  }

  async function handleVoid() {
    if (!activeCompany || !receipt || !canPost) {
      return;
    }
    setActionError("");
    setInfoMessage("");
    try {
      await voidReceipt(activeCompany.id, receipt.id);
      await loadDetail(activeCompany.id);
      setInfoMessage("Receipt voided.");
    } catch (err) {
      if (err instanceof ApiError) {
        setActionError(`Void failed (${err.status}).`);
      } else {
        setActionError("Void failed.");
      }
    }
  }

  function handlePrint() {
    if (!receipt || !activeCompany) {
      return;
    }

    const customerName = customerNameById[receipt.customer] || receipt.customer;
    const invoiceNumberById: Record<string, string> = {};
    for (const invoice of invoices) {
      invoiceNumberById[invoice.id] = invoice.invoice_no ? `#${invoice.invoice_no}` : invoice.id;
    }

    const printed = printReceipt({
      receipt,
      companyName: activeCompany.name,
      customerName,
      invoiceNumberById,
    });

    if (!printed) {
      setActionError("Unable to open print dialog. Check browser print permissions and try again.");
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
            <h2 className="text-lg font-medium text-zinc-900">Receipt Detail</h2>
            <p className="mt-1 text-sm text-zinc-600">
              #{receipt?.receipt_no ?? "-"} | Status: {receipt?.status?.toUpperCase() || "-"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="inline-flex items-center rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
              onClick={handlePrint}
              disabled={!receipt}
            >
              <Printer className="mr-1.5 h-4 w-4" /> Print / PDF
            </button>
            <button
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
              onClick={() => handleNavigate(getCompanyReceiptsPath(activeCompany.slug))}
            >
              Back to Receipts
            </button>
          </div>
        </div>

        {loadingPage || !receipt ? (
          <p className="mt-4 text-sm text-zinc-600">Loading receipt detail...</p>
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
                value={headerForm.received_date}
                onChange={(event) => setHeaderForm((prev) => ({ ...prev, received_date: event.target.value }))}
                disabled={!canEditDraft}
                required
              />
              <input
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
                value={headerForm.amount}
                onChange={(event) => setHeaderForm((prev) => ({ ...prev, amount: event.target.value }))}
                disabled={!canEditDraft}
                required
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
                value={headerForm.deposit_account}
                onChange={(event) => setHeaderForm((prev) => ({ ...prev, deposit_account: event.target.value }))}
                disabled={!canEditDraft}
                required
              >
                <option value="">Deposit account</option>
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
                <h3 className="text-sm font-medium text-zinc-900">Allocations</h3>
                <div className="flex gap-2">
                  <button
                    className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 disabled:opacity-45"
                    onClick={() => setAllocations((prev) => [...prev, newAllocationDraft(openInvoices)])}
                    disabled={!canEditDraft}
                  >
                    Add Allocation
                  </button>
                  <button
                    className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 disabled:opacity-45"
                    onClick={handleAllocationsSave}
                    disabled={!canEditDraft}
                  >
                    Save Allocations
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {allocations.map((allocation, idx) => (
                  <div key={allocation.localId} className="grid gap-2 md:grid-cols-4">
                    <select
                      className="rounded-md border border-zinc-300 px-2 py-1 text-sm md:col-span-2"
                      value={allocation.invoice_id}
                      onChange={(event) =>
                        setAllocations((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, invoice_id: event.target.value } : item))
                        )
                      }
                      disabled={!canEditDraft}
                    >
                      <option value="">Select invoice</option>
                      {openInvoices.map((invoiceItem) => (
                        <option key={invoiceItem.id} value={invoiceItem.id}>
                          #{invoiceItem.invoice_no ?? "draft"} -{" "}
                          {customerNameById[invoiceItem.customer] || invoiceItem.customer}
                        </option>
                      ))}
                    </select>
                    <input
                      className="rounded-md border border-zinc-300 px-2 py-1 text-sm"
                      value={allocation.amount}
                      onChange={(event) =>
                        setAllocations((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, amount: event.target.value } : item))
                        )
                      }
                      disabled={!canEditDraft}
                      placeholder="Amount"
                    />
                    <button
                      className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 disabled:opacity-45"
                      onClick={() => setAllocations((prev) => prev.filter((_, i) => i !== idx))}
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
                disabled={!canPost || receipt.status !== "draft"}
                onClick={handlePost}
                className="rounded border border-zinc-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-45"
              >
                Post Receipt
              </button>
              <button
                disabled={!canPost || receipt.status !== "posted"}
                onClick={handleVoid}
                className="rounded border border-zinc-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-45"
              >
                Void Receipt
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
