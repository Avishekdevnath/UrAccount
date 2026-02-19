"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ChevronRight, Loader2, MoreHorizontal, Plus } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function fmt(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "—";
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
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
    return Object.fromEntries(vendors.map((v) => [v.id, v.name]));
  }, [vendors]);

  const openBills = useMemo(() => {
    return bills.filter((b) => {
      if (!["posted", "partially_paid"].includes(b.status)) return false;
      return toNumber(b.total) > toNumber(b.amount_paid);
    });
  }, [bills]);

  const loadData = useCallback(async (companyId: string) => {
    setLoadingData(true);
    try {
      const [accountData, vendorData, billData, paymentData] = await Promise.all([
        fetchAccounts(companyId),
        fetchContacts(companyId, { type: "vendor" }),
        fetchBills(companyId),
        fetchVendorPayments(companyId),
      ]);
      setAccounts(accountData);
      setVendors(vendorData);
      setBills(billData);
      setVendorPayments(paymentData);
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
    if (!activeCompany) return;
    void loadData(activeCompany.id);
  }, [activeCompany, loadData]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeCompany || !canPost) return;
    setFormError("");
    if (!form.allocation_bill_id) { setFormError("Select a bill allocation."); return; }
    setSubmitting(true);
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
        { bill_id: form.allocation_bill_id, amount: form.allocation_amount },
      ]);
      if (form.post_now) {
        await postVendorPayment(activeCompany.id, created.id, generateIdempotencyKey("vendor-payment-post"));
      }
      setDialogOpen(false);
      await loadData(activeCompany.id);
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(`Create failed (${err.status}).`);
      } else {
        setFormError("Create failed.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePost(paymentId: string) {
    if (!activeCompany || !canPost) return;
    setActionError("");
    try {
      await postVendorPayment(activeCompany.id, paymentId, generateIdempotencyKey("vendor-payment-post"));
      await loadData(activeCompany.id);
    } catch (err) {
      if (err instanceof ApiError) {
        setActionError(`Post failed (${err.status}).`);
      } else {
        setActionError("Post failed.");
      }
    }
  }

  async function handleVoid(paymentId: string) {
    if (!activeCompany || !canPost) return;
    setActionError("");
    try {
      await voidVendorPayment(activeCompany.id, paymentId);
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
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
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
        title="Vendor Payments"
        description="Capture vendor payments and allocate to open bills."
        breadcrumbs={[{ label: "Purchases" }, { label: "Vendor Payments" }]}
        actions={
          canPost && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="mr-1.5 h-3.5 w-3.5" /> New Payment</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>New Vendor Payment</DialogTitle>
                </DialogHeader>
                <form className="mt-2 grid gap-3" onSubmit={handleCreate}>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1.5">
                      <Label>Vendor</Label>
                      <Select value={form.vendor} onValueChange={(v) => setForm((p) => ({ ...p, vendor: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                        <SelectContent>
                          {vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Payment Date</Label>
                      <Input type="date" value={form.paid_date} onChange={(e) => setForm((p) => ({ ...p, paid_date: e.target.value }))} required />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1.5">
                      <Label>Amount</Label>
                      <Input value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} placeholder="0.00" required />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Payment Account</Label>
                      <Select value={form.payment_account} onValueChange={(v) => setForm((p) => ({ ...p, payment_account: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                        <SelectContent>
                          {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1.5">
                      <Label>Allocate to Bill</Label>
                      <Select value={form.allocation_bill_id} onValueChange={(v) => setForm((p) => ({ ...p, allocation_bill_id: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select bill" /></SelectTrigger>
                        <SelectContent>
                          {openBills.map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              #{b.bill_no ?? "draft"} — {vendorNameById[b.vendor] || b.vendor}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Allocation Amount</Label>
                      <Input value={form.allocation_amount} onChange={(e) => setForm((p) => ({ ...p, allocation_amount: e.target.value }))} placeholder="0.00" required />
                    </div>
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Notes</Label>
                    <Input value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Optional notes" />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input type="checkbox" checked={form.post_now} onChange={(e) => setForm((p) => ({ ...p, post_now: e.target.checked }))} className="h-4 w-4 rounded border-border accent-primary" />
                    Post immediately
                  </label>
                  {formError && <p className="text-sm text-destructive">{formError}</p>}
                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={submitting}>
                      {submitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />} Create Payment
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )
        }
      />

      {actionError && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {actionError}
        </div>
      )}

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="font-semibold text-xs w-24">Payment #</TableHead>
              <TableHead className="font-semibold text-xs">Vendor</TableHead>
              <TableHead className="font-semibold text-xs">Date</TableHead>
              <TableHead className="font-semibold text-xs text-right">Amount</TableHead>
              <TableHead className="font-semibold text-xs">Status</TableHead>
              <TableHead className="font-semibold text-xs w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingData ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center">
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                  </div>
                </TableCell>
              </TableRow>
            ) : vendorPayments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center">
                  <p className="text-sm text-muted-foreground">No vendor payments yet.</p>
                </TableCell>
              </TableRow>
            ) : (
              vendorPayments.map((pmt) => (
                <TableRow
                  key={pmt.id}
                  className="cursor-pointer hover:bg-muted/30"
                  onClick={() => handleNavigate(getCompanyVendorPaymentDetailPath(activeCompany.slug, pmt.id))}
                >
                  <TableCell className="font-medium text-sm">{pmt.payment_no ? `#${pmt.payment_no}` : "—"}</TableCell>
                  <TableCell className="text-sm">{vendorNameById[pmt.vendor] || pmt.vendor}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{pmt.paid_date}</TableCell>
                  <TableCell className="text-sm text-right tabular-nums font-medium">{fmt(pmt.amount)}</TableCell>
                  <TableCell><StatusBadge status={pmt.status} /></TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {canPost && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleNavigate(getCompanyVendorPaymentDetailPath(activeCompany.slug, pmt.id))}>
                            <ChevronRight className="mr-2 h-3.5 w-3.5" /> View Detail
                          </DropdownMenuItem>
                          {pmt.status === "draft" && (
                            <DropdownMenuItem onClick={() => void handlePost(pmt.id)}>
                              Post Payment
                            </DropdownMenuItem>
                          )}
                          {pmt.status === "posted" && (
                            <DropdownMenuItem className="text-destructive" onClick={() => void handleVoid(pmt.id)}>
                              Void Payment
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </AppShell>
  );
}
