"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import {
  ApiError,
  fetchAccounts,
  fetchBills,
  fetchContacts,
  fetchVendorPayment,
  postVendorPayment,
  replaceVendorPaymentAllocations,
  updateVendorPayment,
  voidVendorPayment,
} from "@/lib/api-client";
import type { Account, Bill, Contact, VendorPayment } from "@/lib/api-types";
import { getCompanyVendorPaymentsPath } from "@/lib/company-routing";
import { generateIdempotencyKey } from "@/lib/idempotency";
import { useCompanyContext } from "@/lib/use-company-context";

type AllocationDraft = {
  localId: string;
  bill_id: string;
  amount: string;
};

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function newAllocationDraft(bills: Bill[]): AllocationDraft {
  return {
    localId: Math.random().toString(36).slice(2, 10),
    bill_id: bills[0]?.id || "",
    amount: "0.00",
  };
}

export default function VendorPaymentDetailPage() {
  const params = useParams<{ companySlug: string; vendorPaymentId: string }>();
  const companySlug = params.companySlug;
  const vendorPaymentId = params.vendorPaymentId;
  const { isLoading, error, user, companies, activeCompany, access, handleNavigate, handleLogout } =
    useCompanyContext(companySlug);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [vendors, setVendors] = useState<Contact[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [vendorPayment, setVendorPayment] = useState<VendorPayment | null>(null);
  const [loadingPage, setLoadingPage] = useState(false);
  const [headerForm, setHeaderForm] = useState({
    vendor: "",
    paid_date: "",
    amount: "0.00",
    currency_code: "USD",
    payment_account: "",
    notes: "",
  });
  const [allocations, setAllocations] = useState<AllocationDraft[]>([]);
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");

  const canPost = !!access?.permissions.includes("accounting.post");
  const canEditDraft = !!(canPost && vendorPayment?.status === "draft");

  const openBills = useMemo(() => {
    return bills.filter((bill) => {
      if (!["posted", "partially_paid"].includes(bill.status)) {
        return false;
      }
      return toNumber(bill.total) > toNumber(bill.amount_paid);
    });
  }, [bills]);

  const vendorNameById = useMemo(() => {
    return Object.fromEntries(vendors.map((vendor) => [vendor.id, vendor.name]));
  }, [vendors]);

  const loadDetail = useCallback(async (companyId: string) => {
    setLoadingPage(true);
    try {
      const [vendorPaymentData, accountData, vendorData, billData] = await Promise.all([
        fetchVendorPayment(companyId, vendorPaymentId),
        fetchAccounts(companyId),
        fetchContacts(companyId, { type: "vendor" }),
        fetchBills(companyId),
      ]);
      setVendorPayment(vendorPaymentData);
      setAccounts(accountData);
      setVendors(vendorData);
      setBills(billData);
      setHeaderForm({
        vendor: vendorPaymentData.vendor,
        paid_date: vendorPaymentData.paid_date,
        amount: vendorPaymentData.amount,
        currency_code: vendorPaymentData.currency_code,
        payment_account: vendorPaymentData.payment_account,
        notes: vendorPaymentData.notes || "",
      });
      setAllocations(
        vendorPaymentData.allocations.map((allocation) => ({
          localId: allocation.id,
          bill_id: allocation.bill,
          amount: allocation.amount,
        }))
      );
    } finally {
      setLoadingPage(false);
    }
  }, [vendorPaymentId]);

  useEffect(() => {
    if (!activeCompany) {
      return;
    }
    void loadDetail(activeCompany.id);
  }, [activeCompany, loadDetail]);

  async function handleHeaderSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeCompany || !vendorPayment || !canEditDraft) {
      return;
    }
    setFormError("");
    setInfoMessage("");
    try {
      await updateVendorPayment(activeCompany.id, vendorPayment.id, {
        vendor: headerForm.vendor,
        paid_date: headerForm.paid_date,
        amount: headerForm.amount,
        currency_code: headerForm.currency_code || "USD",
        payment_account: headerForm.payment_account,
        notes: headerForm.notes || undefined,
      });
      await loadDetail(activeCompany.id);
      setInfoMessage("Vendor payment header saved.");
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(`Save failed (${err.status}).`);
      } else {
        setFormError("Save failed.");
      }
    }
  }

  async function handleAllocationsSave() {
    if (!activeCompany || !vendorPayment || !canEditDraft) {
      return;
    }
    setFormError("");
    setInfoMessage("");
    if (!allocations.length) {
      setFormError("At least one allocation is required.");
      return;
    }
    try {
      await replaceVendorPaymentAllocations(
        activeCompany.id,
        vendorPayment.id,
        allocations.map((allocation) => ({
          bill_id: allocation.bill_id,
          amount: allocation.amount,
        }))
      );
      await loadDetail(activeCompany.id);
      setInfoMessage("Vendor payment allocations saved.");
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(`Save allocations failed (${err.status}).`);
      } else {
        setFormError("Save allocations failed.");
      }
    }
  }

  async function handlePost() {
    if (!activeCompany || !vendorPayment || !canPost) {
      return;
    }
    setActionError("");
    setInfoMessage("");
    try {
      await postVendorPayment(activeCompany.id, vendorPayment.id, generateIdempotencyKey("vendor-payment-post"));
      await loadDetail(activeCompany.id);
      setInfoMessage("Vendor payment posted.");
    } catch (err) {
      if (err instanceof ApiError) {
        setActionError(`Post failed (${err.status}).`);
      } else {
        setActionError("Post failed.");
      }
    }
  }

  async function handleVoid() {
    if (!activeCompany || !vendorPayment || !canPost) {
      return;
    }
    setActionError("");
    setInfoMessage("");
    try {
      await voidVendorPayment(activeCompany.id, vendorPayment.id);
      await loadDetail(activeCompany.id);
      setInfoMessage("Vendor payment voided.");
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
            <h2 className="text-lg font-medium text-zinc-900">Vendor Payment Detail</h2>
            <p className="mt-1 text-sm text-zinc-600">
              #{vendorPayment?.payment_no ?? "-"} | Status: {vendorPayment?.status?.toUpperCase() || "-"}
            </p>
          </div>
          <button
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
            onClick={() => handleNavigate(getCompanyVendorPaymentsPath(activeCompany.slug))}
          >
            Back to Vendor Payments
          </button>
        </div>

        {loadingPage || !vendorPayment ? (
          <p className="mt-4 text-sm text-zinc-600">Loading vendor payment detail...</p>
        ) : (
          <>
            <form className="mt-4 grid gap-3 md:grid-cols-3" onSubmit={handleHeaderSave}>
              <select
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
                value={headerForm.vendor}
                onChange={(event) => setHeaderForm((prev) => ({ ...prev, vendor: event.target.value }))}
                disabled={!canEditDraft}
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
                value={headerForm.paid_date}
                onChange={(event) => setHeaderForm((prev) => ({ ...prev, paid_date: event.target.value }))}
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
                value={headerForm.payment_account}
                onChange={(event) => setHeaderForm((prev) => ({ ...prev, payment_account: event.target.value }))}
                disabled={!canEditDraft}
                required
              >
                <option value="">Payment account</option>
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
                    onClick={() => setAllocations((prev) => [...prev, newAllocationDraft(openBills)])}
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
                      value={allocation.bill_id}
                      onChange={(event) =>
                        setAllocations((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, bill_id: event.target.value } : item))
                        )
                      }
                      disabled={!canEditDraft}
                    >
                      <option value="">Select bill</option>
                      {openBills.map((bill) => (
                        <option key={bill.id} value={bill.id}>
                          #{bill.bill_no ?? "draft"} - {vendorNameById[bill.vendor] || bill.vendor}
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
                disabled={!canPost || vendorPayment.status !== "draft"}
                onClick={handlePost}
                className="rounded border border-zinc-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-45"
              >
                Post Vendor Payment
              </button>
              <button
                disabled={!canPost || vendorPayment.status !== "posted"}
                onClick={handleVoid}
                className="rounded border border-zinc-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-45"
              >
                Void Vendor Payment
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
