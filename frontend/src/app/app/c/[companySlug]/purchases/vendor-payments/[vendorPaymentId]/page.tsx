"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2, Plus, Save } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  return { localId: Math.random().toString(36).slice(2, 10), bill_id: bills[0]?.id || "", amount: "0.00" };
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
  const [headerForm, setHeaderForm] = useState({ vendor: "", paid_date: "", amount: "0.00", currency_code: "USD", payment_account: "", notes: "" });
  const [allocations, setAllocations] = useState<AllocationDraft[]>([]);
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [savingHeader, setSavingHeader] = useState(false);
  const [savingAllocations, setSavingAllocations] = useState(false);

  const canPost = !!access?.permissions.includes("accounting.post");
  const canEditDraft = !!(canPost && vendorPayment?.status === "draft");

  const openBills = useMemo(() => bills.filter((b) => {
    if (!["posted", "partially_paid"].includes(b.status)) return false;
    return toNumber(b.total) > toNumber(b.amount_paid);
  }), [bills]);

  const vendorNameById = useMemo(() => Object.fromEntries(vendors.map((v) => [v.id, v.name])), [vendors]);

  const loadDetail = useCallback(async (companyId: string) => {
    setLoadingPage(true);
    try {
      const [paymentData, accountData, vendorData, billData] = await Promise.all([
        fetchVendorPayment(companyId, vendorPaymentId),
        fetchAccounts(companyId),
        fetchContacts(companyId, { type: "vendor" }),
        fetchBills(companyId),
      ]);
      setVendorPayment(paymentData);
      setAccounts(accountData);
      setVendors(vendorData);
      setBills(billData);
      setHeaderForm({
        vendor: paymentData.vendor,
        paid_date: paymentData.paid_date,
        amount: paymentData.amount,
        currency_code: paymentData.currency_code,
        payment_account: paymentData.payment_account,
        notes: paymentData.notes || "",
      });
      setAllocations(paymentData.allocations.map((a) => ({ localId: a.id, bill_id: a.bill, amount: a.amount })));
    } finally {
      setLoadingPage(false);
    }
  }, [vendorPaymentId]);

  useEffect(() => {
    if (!activeCompany) return;
    void loadDetail(activeCompany.id);
  }, [activeCompany, loadDetail]);

  async function handleHeaderSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeCompany || !vendorPayment || !canEditDraft) return;
    setFormError(""); setInfoMessage(""); setSavingHeader(true);
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
      setInfoMessage("Header saved.");
    } catch (err) {
      setFormError(err instanceof ApiError ? `Save failed (${err.status}).` : "Save failed.");
    } finally {
      setSavingHeader(false);
    }
  }

  async function handleAllocationsSave() {
    if (!activeCompany || !vendorPayment || !canEditDraft) return;
    setFormError(""); setInfoMessage("");
    if (!allocations.length) { setFormError("At least one allocation is required."); return; }
    setSavingAllocations(true);
    try {
      await replaceVendorPaymentAllocations(activeCompany.id, vendorPayment.id, allocations.map((a) => ({ bill_id: a.bill_id, amount: a.amount })));
      await loadDetail(activeCompany.id);
      setInfoMessage("Allocations saved.");
    } catch (err) {
      setFormError(err instanceof ApiError ? `Save allocations failed (${err.status}).` : "Save allocations failed.");
    } finally {
      setSavingAllocations(false);
    }
  }

  async function handlePost() {
    if (!activeCompany || !vendorPayment || !canPost) return;
    setActionError(""); setInfoMessage("");
    try {
      await postVendorPayment(activeCompany.id, vendorPayment.id, generateIdempotencyKey("vendor-payment-post"));
      await loadDetail(activeCompany.id);
      setInfoMessage("Payment posted.");
    } catch (err) {
      setActionError(err instanceof ApiError ? `Post failed (${err.status}).` : "Post failed.");
    }
  }

  async function handleVoid() {
    if (!activeCompany || !vendorPayment || !canPost) return;
    setActionError(""); setInfoMessage("");
    try {
      await voidVendorPayment(activeCompany.id, vendorPayment.id);
      await loadDetail(activeCompany.id);
      setInfoMessage("Payment voided.");
    } catch (err) {
      setActionError(err instanceof ApiError ? `Void failed (${err.status}).` : "Void failed.");
    }
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      </main>
    );
  }

  if (error || !user || !activeCompany || !access) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <section className="w-full max-w-md rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive">
          <p>{error || "Access context is missing."}</p>
          <button className="mt-3 text-sm underline" onClick={handleLogout}>Go to login</button>
        </section>
      </main>
    );
  }

  return (
    <AppShell user={user} companies={companies} activeCompany={activeCompany} access={access} onLogout={handleLogout} onNavigate={handleNavigate}>
      <PageHeader
        title={vendorPayment ? `Payment #${vendorPayment.payment_no ?? "—"}` : "Vendor Payment"}
        description={vendorPayment ? `${vendorNameById[vendorPayment.vendor] || "Vendor"} · ${vendorPayment.paid_date}` : ""}
        breadcrumbs={[{ label: "Purchases" }, { label: "Vendor Payments" }, { label: "Detail" }]}
        actions={
          <div className="flex items-center gap-2">
            {vendorPayment && <StatusBadge status={vendorPayment.status} />}
            <Button variant="outline" size="sm" onClick={() => handleNavigate(getCompanyVendorPaymentsPath(activeCompany.slug))}>
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back
            </Button>
            {canPost && vendorPayment?.status === "draft" && (
              <Button size="sm" onClick={handlePost}>Post Payment</Button>
            )}
            {canPost && vendorPayment?.status === "posted" && (
              <Button size="sm" variant="outline" className="text-destructive border-destructive/30" onClick={handleVoid}>Void</Button>
            )}
          </div>
        }
      />

      {(formError || actionError) && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {formError || actionError}
        </div>
      )}
      {infoMessage && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {infoMessage}
        </div>
      )}

      {loadingPage || !vendorPayment ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="space-y-5">
          {/* Header form */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-foreground">Payment Details</h2>
            <form className="grid gap-4" onSubmit={handleHeaderSave}>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="grid gap-1.5">
                  <Label>Vendor</Label>
                  <Select value={headerForm.vendor} onValueChange={(v) => setHeaderForm((p) => ({ ...p, vendor: v }))} disabled={!canEditDraft}>
                    <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                    <SelectContent>
                      {vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Payment Date</Label>
                  <Input type="date" value={headerForm.paid_date} onChange={(e) => setHeaderForm((p) => ({ ...p, paid_date: e.target.value }))} disabled={!canEditDraft} required />
                </div>
                <div className="grid gap-1.5">
                  <Label>Amount</Label>
                  <Input value={headerForm.amount} onChange={(e) => setHeaderForm((p) => ({ ...p, amount: e.target.value }))} disabled={!canEditDraft} required />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="grid gap-1.5">
                  <Label>Currency</Label>
                  <Input value={headerForm.currency_code} onChange={(e) => setHeaderForm((p) => ({ ...p, currency_code: e.target.value }))} disabled={!canEditDraft} maxLength={3} />
                </div>
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label>Payment Account</Label>
                  <Select value={headerForm.payment_account} onValueChange={(v) => setHeaderForm((p) => ({ ...p, payment_account: v }))} disabled={!canEditDraft}>
                    <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                    <SelectContent>
                      {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>Notes</Label>
                <Input value={headerForm.notes} onChange={(e) => setHeaderForm((p) => ({ ...p, notes: e.target.value }))} disabled={!canEditDraft} placeholder="Optional notes" />
              </div>
              {canEditDraft && (
                <div>
                  <Button type="submit" size="sm" disabled={savingHeader}>
                    {savingHeader ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
                    Save Header
                  </Button>
                </div>
              )}
            </form>
          </div>

          {/* Allocations */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Bill Allocations</h2>
              {canEditDraft && (
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => setAllocations((prev) => [...prev, newAllocationDraft(openBills)])}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Add
                  </Button>
                  <Button type="button" size="sm" onClick={handleAllocationsSave} disabled={savingAllocations}>
                    {savingAllocations && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />} Save Allocations
                  </Button>
                </div>
              )}
            </div>
            <div className="space-y-3">
              {allocations.length === 0 && (
                <p className="text-sm text-muted-foreground">No allocations yet.</p>
              )}
              {allocations.map((alloc, idx) => (
                <div key={alloc.localId} className="grid gap-3 sm:grid-cols-4">
                  <div className="sm:col-span-2">
                    <Select value={alloc.bill_id} onValueChange={(v) => setAllocations((prev) => prev.map((a, i) => i === idx ? { ...a, bill_id: v } : a))} disabled={!canEditDraft}>
                      <SelectTrigger><SelectValue placeholder="Select bill" /></SelectTrigger>
                      <SelectContent>
                        {openBills.map((b) => (
                          <SelectItem key={b.id} value={b.id}>#{b.bill_no ?? "draft"} — {vendorNameById[b.vendor] || b.vendor}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Input value={alloc.amount} onChange={(e) => setAllocations((prev) => prev.map((a, i) => i === idx ? { ...a, amount: e.target.value } : a))} disabled={!canEditDraft} placeholder="Amount" />
                  </div>
                  {canEditDraft && (
                    <div>
                      <Button type="button" size="sm" variant="outline" className="text-destructive" onClick={() => setAllocations((prev) => prev.filter((_, i) => i !== idx))}>
                        Remove
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
