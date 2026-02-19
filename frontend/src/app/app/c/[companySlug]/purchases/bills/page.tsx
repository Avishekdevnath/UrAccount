"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, MoreHorizontal, Plus } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import {
  ApiError,
  createBill,
  fetchAccounts,
  fetchBills,
  fetchContacts,
  postBill,
  replaceBillLines,
  voidBill,
} from "@/lib/api-client";
import type { Account, Bill, Contact } from "@/lib/api-types";
import { getCompanyBillDetailPath } from "@/lib/company-routing";
import { useCompanyContext } from "@/lib/use-company-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { cn } from "@/lib/utils";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "posted", label: "Posted" },
  { value: "partially_paid", label: "Partially Paid" },
  { value: "paid", label: "Paid" },
  { value: "void", label: "Void" },
];

function formatCurrency(value: string | null | undefined): string {
  if (!value) return "—";
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
}

export default function BillsPage() {
  const params = useParams<{ companySlug: string }>();
  const companySlug = params.companySlug;
  const { isLoading, error, user, companies, activeCompany, access, handleNavigate, handleLogout } =
    useCompanyContext(companySlug);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [vendors, setVendors] = useState<Contact[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [loadingData, setLoadingData] = useState(false);
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    vendor: "",
    bill_date: new Date().toISOString().slice(0, 10),
    due_date: new Date().toISOString().slice(0, 10),
    ap_account: "",
    expense_account_id: "",
    line_description: "Service cost",
    quantity: "1",
    unit_cost: "100.00",
    notes: "",
    post_now: true,
  });

  const canPost = !!access?.permissions.includes("accounting.post");
  const vendorNameById = useMemo(() => Object.fromEntries(vendors.map((v) => [v.id, v.name])), [vendors]);

  const loadData = useCallback(async (companyId: string, status: string) => {
    setLoadingData(true);
    try {
      const [accountData, vendorData, billData] = await Promise.all([
        fetchAccounts(companyId),
        fetchContacts(companyId, { type: "vendor" }),
        fetchBills(companyId, status === "all" ? undefined : status),
      ]);
      setAccounts(accountData);
      setVendors(vendorData);
      setBills(billData);
      setForm((prev) => ({
        ...prev,
        ap_account: prev.ap_account || accountData[0]?.id || "",
        expense_account_id: prev.expense_account_id || accountData[0]?.id || "",
        vendor: prev.vendor || vendorData[0]?.id || "",
      }));
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (!activeCompany) return;
    void loadData(activeCompany.id, statusFilter);
  }, [activeCompany, loadData, statusFilter]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeCompany || !canPost) return;
    setFormError("");
    setSubmitting(true);
    try {
      const bill = await createBill(activeCompany.id, {
        vendor: form.vendor,
        bill_date: form.bill_date,
        due_date: form.due_date || undefined,
        currency_code: "USD",
        notes: form.notes || undefined,
        ap_account: form.ap_account,
      });
      await replaceBillLines(activeCompany.id, bill.id, [
        { description: form.line_description, quantity: form.quantity, unit_cost: form.unit_cost, expense_account_id: form.expense_account_id },
      ]);
      if (form.post_now) await postBill(activeCompany.id, bill.id);
      setDialogOpen(false);
      await loadData(activeCompany.id, statusFilter);
    } catch (err) {
      setFormError(err instanceof ApiError ? `Create failed (${err.status}).` : "Create failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePost(billId: string) {
    if (!activeCompany || !canPost) return;
    setActionError("");
    try {
      await postBill(activeCompany.id, billId);
      await loadData(activeCompany.id, statusFilter);
    } catch (err) {
      setActionError(err instanceof ApiError ? `Post failed (${err.status}).` : "Post failed.");
    }
  }

  async function handleVoid(billId: string) {
    if (!activeCompany || !canPost) return;
    setActionError("");
    try {
      await voidBill(activeCompany.id, billId);
      await loadData(activeCompany.id, statusFilter);
    } catch (err) {
      setActionError(err instanceof ApiError ? `Void failed (${err.status}).` : "Void failed.");
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
        title="Bills"
        description="Manage vendor bills — create, post, and track payments."
        breadcrumbs={[{ label: "Purchases" }, { label: "Bills" }]}
        actions={
          <Button size="sm" onClick={() => setDialogOpen(true)} disabled={!canPost}>
            <Plus className="mr-1.5 h-4 w-4" /> New Bill
          </Button>
        }
      />

      <div className="mb-4 flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-44 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          {loadingData ? "Loading…" : `${bills.length} result${bills.length !== 1 ? "s" : ""}`}
        </span>
      </div>

      {actionError && (
        <div className="mb-4 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
          <p className="text-sm text-destructive">{actionError}</p>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-28 font-semibold text-xs">Bill #</TableHead>
              <TableHead className="font-semibold text-xs">Vendor</TableHead>
              <TableHead className="font-semibold text-xs">Bill Date</TableHead>
              <TableHead className="font-semibold text-xs">Due Date</TableHead>
              <TableHead className="font-semibold text-xs text-right">Total</TableHead>
              <TableHead className="font-semibold text-xs text-right">Paid</TableHead>
              <TableHead className="font-semibold text-xs">Status</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingData ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center">
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading bills…
                  </div>
                </TableCell>
              </TableRow>
            ) : bills.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center">
                  <p className="text-sm text-muted-foreground">No bills found.</p>
                  {canPost && (
                    <button onClick={() => setDialogOpen(true)} className="mt-2 text-sm text-primary hover:underline">
                      Create your first bill
                    </button>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              bills.map((bill) => (
                <TableRow key={bill.id} className="cursor-pointer" onClick={() => handleNavigate(getCompanyBillDetailPath(activeCompany.slug, bill.id))}>
                  <TableCell className="font-medium text-sm">{bill.bill_no ? `#${bill.bill_no}` : "—"}</TableCell>
                  <TableCell className="text-sm">{vendorNameById[bill.vendor] || bill.vendor}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{bill.bill_date}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{bill.due_date ?? "—"}</TableCell>
                  <TableCell className="text-sm text-right tabular-nums font-medium">{formatCurrency(bill.total)}</TableCell>
                  <TableCell className="text-sm text-right tabular-nums text-muted-foreground">{formatCurrency(bill.amount_paid)}</TableCell>
                  <TableCell><StatusBadge status={bill.status} /></TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleNavigate(getCompanyBillDetailPath(activeCompany.slug, bill.id))}>View detail</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem disabled={!canPost || bill.status !== "draft"} onClick={() => handlePost(bill.id)}>Post bill</DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={!canPost || !["posted", "partially_paid"].includes(bill.status)}
                          onClick={() => handleVoid(bill.id)}
                          className={cn(canPost && ["posted", "partially_paid"].includes(bill.status) ? "text-destructive focus:text-destructive" : "")}
                        >
                          Void bill
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Bill</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Vendor</Label>
                <Select value={form.vendor} onValueChange={(v) => setForm((p) => ({ ...p, vendor: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                  <SelectContent>{vendors.map((v) => (<SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Bill Date</Label>
                <Input type="date" value={form.bill_date} onChange={(e) => setForm((p) => ({ ...p, bill_date: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label>Due Date</Label>
                <Input type="date" value={form.due_date} onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>AP Account</Label>
                <Select value={form.ap_account} onValueChange={(v) => setForm((p) => ({ ...p, ap_account: v }))}>
                  <SelectTrigger><SelectValue placeholder="AP account" /></SelectTrigger>
                  <SelectContent>{accounts.map((a) => (<SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Expense Account</Label>
                <Select value={form.expense_account_id} onValueChange={(v) => setForm((p) => ({ ...p, expense_account_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Expense account" /></SelectTrigger>
                  <SelectContent>{accounts.map((a) => (<SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Line Description</Label>
                <Input value={form.line_description} onChange={(e) => setForm((p) => ({ ...p, line_description: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label>Quantity</Label>
                <Input value={form.quantity} onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label>Unit Cost</Label>
                <Input value={form.unit_cost} onChange={(e) => setForm((p) => ({ ...p, unit_cost: e.target.value }))} required />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.post_now} onChange={(e) => setForm((p) => ({ ...p, post_now: e.target.checked }))} className="rounded border-border" />
                  <span className="font-medium">Post immediately after creation</span>
                </label>
              </div>
            </div>
            {formError && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
                <p className="text-sm text-destructive">{formError}</p>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting || !form.vendor || !form.ap_account || !form.expense_account_id}>
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating…</> : "Create Bill"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
