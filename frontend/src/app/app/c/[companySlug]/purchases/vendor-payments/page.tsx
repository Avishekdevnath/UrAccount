"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import {
  ApiError,
  createVendorPayment,
  fetchAccounts,
  fetchBills,
  fetchContacts,
  fetchVendorPayments,
  postVendorPayment,
  replaceVendorPaymentAllocations,
  voidVendorPayment,
} from "@/lib/api-client";
import type { Account, Bill, Contact, VendorPayment } from "@/lib/api-types";
import { getCompanyVendorPaymentDetailPath } from "@/lib/company-routing";
import { generateIdempotencyKey } from "@/lib/idempotency";
import { useCompanyContext } from "@/lib/use-company-context";

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function VendorPaymentsPage() {
  const params = useParams<{ companySlug: string }>();
  const companySlug = params.companySlug;
  const { isLoading, error, user, companies, activeCompany, access, handleNavigate, handleLogout } =
    useCompanyContext(companySlug);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [vendors, setVendors] = useState<Contact[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [vendorPayments, setVendorPayments] = useState<VendorPayment[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");
  const [form, setForm] = useState({
    vendor: "",
    paid_date: new Date().toISOString().slice(0, 10),
    amount: "100.00",
    payment_account: "",
    allocation_bill_id: "",
    allocation_amount: "100.00",
    notes: "",
    post_now: true,
  });

  const canPost = !!access?.permissions.includes("accounting.post");
  const vendorNameById = useMemo(() => {
    return Object.fromEntries(vendors.map((vendor) => [vendor.id, vendor.name]));
  }, [vendors]);

  const openBills = useMemo(() => {
    return bills.filter((bill) => {
      if (!["posted", "partially_paid"].includes(bill.status)) {
        return false;
      }
      return toNumber(bill.total) > toNumber(bill.amount_paid);
    });
  }, [bills]);

  const loadData = useCallback(async (companyId: string) => {
    setLoadingData(true);
    try {
      const [accountData, vendorData, billData, vendorPaymentData] = await Promise.all([
        fetchAccounts(companyId),
        fetchContacts(companyId, { type: "vendor" }),
        fetchBills(companyId),
        fetchVendorPayments(companyId),
      ]);
      setAccounts(accountData);
      setVendors(vendorData);
      setBills(billData);
      setVendorPayments(vendorPaymentData);
      setForm((prev) => ({
        ...prev,
        payment_account: prev.payment_account || accountData[0]?.id || "",
        vendor: prev.vendor || vendorData[0]?.id || "",
        allocation_bill_id: prev.allocation_bill_id || billData[0]?.id || "",
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
    if (!form.allocation_bill_id) {
      setFormError("Select a bill allocation.");
      return;
    }
    try {
      const created = await createVendorPayment(
        activeCompany.id,
        {
          vendor: form.vendor,
          paid_date: form.paid_date,
          amount: form.amount,
          currency_code: "USD",
          payment_account: form.payment_account,
          notes: form.notes || undefined,
        },
        generateIdempotencyKey("vendor-payment-create")
      );
      await replaceVendorPaymentAllocations(activeCompany.id, created.id, [
        {
          bill_id: form.allocation_bill_id,
          amount: form.allocation_amount,
        },
      ]);
      if (form.post_now) {
        await postVendorPayment(activeCompany.id, created.id, generateIdempotencyKey("vendor-payment-post"));
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

  async function handlePost(vendorPaymentId: string) {
    if (!activeCompany || !canPost) {
      return;
    }
    setActionError("");
    try {
      await postVendorPayment(activeCompany.id, vendorPaymentId, generateIdempotencyKey("vendor-payment-post"));
      await loadData(activeCompany.id);
    } catch (err) {
      if (err instanceof ApiError) {
        setActionError(`Post failed (${err.status}).`);
      } else {
        setActionError("Post failed.");
      }
    }
  }

  async function handleVoid(vendorPaymentId: string) {
    if (!activeCompany || !canPost) {
      return;
    }
    setActionError("");
    try {
      await voidVendorPayment(activeCompany.id, vendorPaymentId);
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
        <h2 className="text-lg font-medium text-zinc-900">Vendor Payments</h2>
        <p className="mt-1 text-sm text-zinc-600">Capture vendor payments and allocate to open bills.</p>

        <form className="mt-4 grid gap-3 md:grid-cols-3" onSubmit={handleCreate}>
          <select
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            value={form.vendor}
            onChange={(event) => setForm((prev) => ({ ...prev, vendor: event.target.value }))}
            required
          >
            <option value="">Select vendor</option>
            {vendors.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            value={form.paid_date}
            onChange={(event) => setForm((prev) => ({ ...prev, paid_date: event.target.value }))}
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
            value={form.payment_account}
            onChange={(event) => setForm((prev) => ({ ...prev, payment_account: event.target.value }))}
            required
          >
            <option value="">Payment account</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.code} - {account.name}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            value={form.allocation_bill_id}
            onChange={(event) => setForm((prev) => ({ ...prev, allocation_bill_id: event.target.value }))}
            required
          >
            <option value="">Allocate bill</option>
            {openBills.map((bill) => (
              <option key={bill.id} value={bill.id}>
                #{bill.bill_no ?? "draft"} - {vendorNameById[bill.vendor] || bill.vendor}
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
            Create Vendor Payment
          </button>
        </form>
        {formError ? <p className="mt-2 text-sm text-red-600">{formError}</p> : null}
        {actionError ? <p className="mt-2 text-sm text-red-600">{actionError}</p> : null}

        <div className="mt-6 overflow-x-auto">
          {loadingData ? (
            <p className="text-sm text-zinc-600">Loading vendor payments...</p>
          ) : (
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-600">
                  <th className="py-2 pr-3">Payment #</th>
                  <th className="py-2 pr-3">Vendor</th>
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Amount</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {vendorPayments.map((vendorPayment) => (
                  <tr key={vendorPayment.id} className="border-b border-zinc-100">
                    <td className="py-2 pr-3">{vendorPayment.payment_no ?? "-"}</td>
                    <td className="py-2 pr-3">{vendorNameById[vendorPayment.vendor] || vendorPayment.vendor}</td>
                    <td className="py-2 pr-3">{vendorPayment.paid_date}</td>
                    <td className="py-2 pr-3">{vendorPayment.amount}</td>
                    <td className="py-2 pr-3 uppercase">{vendorPayment.status}</td>
                    <td className="py-2 pr-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            handleNavigate(getCompanyVendorPaymentDetailPath(activeCompany.slug, vendorPayment.id))
                          }
                          className="rounded border border-zinc-300 px-2 py-1 text-xs"
                        >
                          Open
                        </button>
                        <button
                          disabled={!canPost || vendorPayment.status !== "draft"}
                          onClick={() => handlePost(vendorPayment.id)}
                          className="rounded border border-zinc-300 px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          Post
                        </button>
                        <button
                          disabled={!canPost || vendorPayment.status !== "posted"}
                          onClick={() => handleVoid(vendorPayment.id)}
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
