"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, MoreHorizontal, Plus } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
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

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: string | null | undefined): string {
  if (!value) return "—";
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
  const customerNameById = useMemo(() => Object.fromEntries(customers.map((c) => [c.id, c.name])), [customers]);
  const openInvoices = useMemo(() => invoices.filter((inv) => ["posted", "partially_paid"].includes(inv.status) && toNumber(inv.total) > toNumber(inv.amount_paid)), [invoices]);

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
    if (!activeCompany) return;
    void loadData(activeCompany.id);
  }, [activeCompany, loadData]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeCompany || !canPost) return;
    setFormError("");
    if (!form.allocation_invoice_id) { setFormError("Select an invoice to allocate."); return; }
    setSubmitting(true);
    try {
      const created = await createReceipt(
        activeCompany.id,
        { customer: form.customer, received_date: form.received_date, amount: form.amount, currency_code: "USD", deposit_account: form.deposit_account, notes: form.notes || undefined },
        generateIdempotencyKey("receipt-create")
      );
      await replaceReceiptAllocations(activeCompany.id, created.id, [{ invoice_id: form.allocation_invoice_id, amount: form.allocation_amount }]);
      if (form.post_now) await postReceipt(activeCompany.id, created.id, generateIdempotencyKey("receipt-post"));
      setDialogOpen(false);
      await loadData(activeCompany.id);
    } catch (err) {
      setFormError(err instanceof ApiError ? `Create failed (${err.status}).` : "Create failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePost(receiptId: string) {
    if (!activeCompany || !canPost) return;
    setActionError("");
    try {
      await postReceipt(activeCompany.id, receiptId, generateIdempotencyKey("receipt-post"));
      await loadData(activeCompany.id);
    } catch (err) {
      setActionError(err instanceof ApiError ? `Post failed (${err.status}).` : "Post failed.");
    }
  }

  async function handleVoid(receiptId: string) {
    if (!activeCompany || !canPost) return;
    setActionError("");
    try {
      await voidReceipt(activeCompany.id, receiptId);
      await loadData(activeCompany.id);
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
        title="Receipts"
        description="Capture customer payments and allocate to open invoices."
        breadcrumbs={[{ label: "Sales" }, { label: "Receipts" }]}
        actions={
          <Button size="sm" onClick={() => setDialogOpen(true)} disabled={!canPost}>
            <Plus className="mr-1.5 h-4 w-4" /> New Receipt
          </Button>
        }
      />

      {actionError && (
        <div className="mb-4 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
          <p className="text-sm text-destructive">{actionError}</p>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-28 font-semibold text-xs">Receipt #</TableHead>
              <TableHead className="font-semibold text-xs">Customer</TableHead>
              <TableHead className="font-semibold text-xs">Date</TableHead>
              <TableHead className="font-semibold text-xs text-right">Amount</TableHead>
              <TableHead className="font-semibold text-xs">Status</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingData ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center">
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
                </TableCell>
              </TableRow>
            ) : receipts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center">
                  <p className="text-sm text-muted-foreground">No receipts yet.</p>
                  {canPost && <button onClick={() => setDialogOpen(true)} className="mt-2 text-sm text-primary hover:underline">Create your first receipt</button>}
                </TableCell>
              </TableRow>
            ) : (
              receipts.map((receipt) => (
                <TableRow key={receipt.id} className="cursor-pointer" onClick={() => handleNavigate(getCompanyReceiptDetailPath(activeCompany.slug, receipt.id))}>
                  <TableCell className="font-medium text-sm">{receipt.receipt_no ? `#${receipt.receipt_no}` : "—"}</TableCell>
                  <TableCell className="text-sm">{customerNameById[receipt.customer] || receipt.customer}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{receipt.received_date}</TableCell>
                  <TableCell className="text-sm text-right tabular-nums font-medium">{formatCurrency(receipt.amount)}</TableCell>
                  <TableCell><StatusBadge status={receipt.status} /></TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleNavigate(getCompanyReceiptDetailPath(activeCompany.slug, receipt.id))}>View detail</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem disabled={!canPost || receipt.status !== "draft"} onClick={() => handlePost(receipt.id)}>Post receipt</DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={!canPost || receipt.status !== "posted"}
                          onClick={() => handleVoid(receipt.id)}
                          className={cn(canPost && receipt.status === "posted" ? "text-destructive focus:text-destructive" : "")}
                        >Void receipt</DropdownMenuItem>
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
          <DialogHeader><DialogTitle>New Receipt</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Customer</Label>
                <Select value={form.customer} onValueChange={(v) => setForm((p) => ({ ...p, customer: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                  <SelectContent>{customers.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Received Date</Label>
                <Input type="date" value={form.received_date} onChange={(e) => setForm((p) => ({ ...p, received_date: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label>Amount</Label>
                <Input value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} placeholder="0.00" required />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Deposit Account</Label>
                <Select value={form.deposit_account} onValueChange={(v) => setForm((p) => ({ ...p, deposit_account: v }))}>
                  <SelectTrigger><SelectValue placeholder="Deposit account" /></SelectTrigger>
                  <SelectContent>{accounts.map((a) => (<SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Allocate to Invoice</Label>
                <Select value={form.allocation_invoice_id} onValueChange={(v) => setForm((p) => ({ ...p, allocation_invoice_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select invoice" /></SelectTrigger>
                  <SelectContent>
                    {openInvoices.map((inv) => (<SelectItem key={inv.id} value={inv.id}>#{inv.invoice_no ?? "draft"} — {customerNameById[inv.customer] || inv.customer}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Allocation Amount</Label>
                <Input value={form.allocation_amount} onChange={(e) => setForm((p) => ({ ...p, allocation_amount: e.target.value }))} placeholder="0.00" required />
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
            {formError && <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2"><p className="text-sm text-destructive">{formError}</p></div>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting || !form.customer || !form.deposit_account}>
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating…</> : "Create Receipt"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
