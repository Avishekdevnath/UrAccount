"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, MoreHorizontal, Plus } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
    return Object.fromEntries(customers.map((c) => [c.id, c.name]));
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
    if (!activeCompany) return;
    void loadData(activeCompany.id, statusFilter);
  }, [activeCompany, loadData, statusFilter]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeCompany || !canPost) return;
    setFormError("");
    setSubmitting(true);
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
      setDialogOpen(false);
      await loadData(activeCompany.id, statusFilter);
    } catch (err) {
      setFormError(err instanceof ApiError ? `Create failed (${err.status}).` : "Create failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePost(invoiceId: string) {
    if (!activeCompany || !canPost) return;
    setActionError("");
    try {
      await postInvoice(activeCompany.id, invoiceId);
      await loadData(activeCompany.id, statusFilter);
    } catch (err) {
      setActionError(err instanceof ApiError ? `Post failed (${err.status}).` : "Post failed.");
    }
  }

  async function handleVoid(invoiceId: string) {
    if (!activeCompany || !canPost) return;
    setActionError("");
    try {
      await voidInvoice(activeCompany.id, invoiceId);
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
    <AppShell
      user={user}
      companies={companies}
      activeCompany={activeCompany}
      access={access}
      onLogout={handleLogout}
      onNavigate={handleNavigate}
    >
      <PageHeader
        title="Invoices"
        description="Manage customer invoices — create, post, and track payments."
        breadcrumbs={[{ label: "Sales" }, { label: "Invoices" }]}
        actions={
          <Button onClick={() => setDialogOpen(true)} disabled={!canPost} size="sm">
            <Plus className="mr-1.5 h-4 w-4" />
            New Invoice
          </Button>
        }
      />

      {/* Filters */}
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
          {loadingData ? "Loading…" : `${invoices.length} result${invoices.length !== 1 ? "s" : ""}`}
        </span>
      </div>

      {actionError && (
        <div className="mb-4 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
          <p className="text-sm text-destructive">{actionError}</p>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-28 font-semibold text-xs">Invoice #</TableHead>
              <TableHead className="font-semibold text-xs">Customer</TableHead>
              <TableHead className="font-semibold text-xs">Issue Date</TableHead>
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
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading invoices…
                  </div>
                </TableCell>
              </TableRow>
            ) : invoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center">
                  <p className="text-sm text-muted-foreground">No invoices found.</p>
                  {canPost && (
                    <button
                      onClick={() => setDialogOpen(true)}
                      className="mt-2 text-sm text-primary hover:underline"
                    >
                      Create your first invoice
                    </button>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              invoices.map((invoice) => (
                <TableRow
                  key={invoice.id}
                  className="cursor-pointer"
                  onClick={() => handleNavigate(getCompanyInvoiceDetailPath(activeCompany.slug, invoice.id))}
                >
                  <TableCell className="font-medium text-sm">
                    {invoice.invoice_no ? `#${invoice.invoice_no}` : "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {customerNameById[invoice.customer] || invoice.customer}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{invoice.issue_date}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{invoice.due_date ?? "—"}</TableCell>
                  <TableCell className="text-sm text-right tabular-nums font-medium">
                    {formatCurrency(invoice.total)}
                  </TableCell>
                  <TableCell className="text-sm text-right tabular-nums text-muted-foreground">
                    {formatCurrency(invoice.amount_paid)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={invoice.status} />
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => handleNavigate(getCompanyInvoiceDetailPath(activeCompany.slug, invoice.id))}
                        >
                          View detail
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          disabled={!canPost || invoice.status !== "draft"}
                          onClick={() => handlePost(invoice.id)}
                        >
                          Post invoice
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={!canPost || !["posted", "partially_paid"].includes(invoice.status)}
                          onClick={() => handleVoid(invoice.id)}
                          className={cn(
                            canPost && ["posted", "partially_paid"].includes(invoice.status)
                              ? "text-destructive focus:text-destructive"
                              : ""
                          )}
                        >
                          Void invoice
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

      {/* Create Invoice Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Invoice</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Customer</Label>
                <Select value={form.customer} onValueChange={(v) => setForm((p) => ({ ...p, customer: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Issue Date</Label>
                <Input
                  type="date"
                  value={form.issue_date}
                  onChange={(e) => setForm((p) => ({ ...p, issue_date: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>AR Account</Label>
                <Select value={form.ar_account} onValueChange={(v) => setForm((p) => ({ ...p, ar_account: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="AR account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Revenue Account</Label>
                <Select value={form.revenue_account_id} onValueChange={(v) => setForm((p) => ({ ...p, revenue_account_id: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Revenue account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Line Description</Label>
                <Input
                  value={form.line_description}
                  onChange={(e) => setForm((p) => ({ ...p, line_description: e.target.value }))}
                  placeholder="Service fee"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Quantity</Label>
                <Input
                  value={form.quantity}
                  onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))}
                  placeholder="1"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Unit Price</Label>
                <Input
                  value={form.unit_price}
                  onChange={(e) => setForm((p) => ({ ...p, unit_price: e.target.value }))}
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input
                  value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Internal notes…"
                />
              </div>
              <div className="col-span-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.post_now}
                    onChange={(e) => setForm((p) => ({ ...p, post_now: e.target.checked }))}
                    className="rounded border-border"
                  />
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
              <Button type="submit" disabled={submitting || !form.customer || !form.ar_account || !form.revenue_account_id}>
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating…</> : "Create Invoice"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
