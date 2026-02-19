"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2, Plus, Printer, Save } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import {
  ApiError,
  fetchAccounts,
  fetchContacts,
  fetchInvoice,
  postInvoice,
  replaceInvoiceLines,
  updateInvoice,
  voidInvoice,
} from "@/lib/api-client";
import type { Account, Contact, Invoice } from "@/lib/api-types";
import { getCompanyDashboardPath, getCompanyInvoicesPath } from "@/lib/company-routing";
import { printInvoice } from "@/lib/invoice-print";
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
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type InvoiceLineDraft = {
  localId: string;
  description: string;
  quantity: string;
  unit_price: string;
  revenue_account_id: string;
};

function newLineDraft(accounts: Account[]): InvoiceLineDraft {
  return { localId: Math.random().toString(36).slice(2, 10), description: "", quantity: "1", unit_price: "0.00", revenue_account_id: accounts[0]?.id || "" };
}

function fmt(num: number): string {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
}

export default function InvoiceDetailPage() {
  const params = useParams<{ companySlug: string; invoiceId: string }>();
  const companySlug = params.companySlug;
  const invoiceId = params.invoiceId;
  const { isLoading, error, user, companies, activeCompany, access, handleNavigate, handleLogout } =
    useCompanyContext(companySlug);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [customers, setCustomers] = useState<Contact[]>([]);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loadingPage, setLoadingPage] = useState(false);
  const [headerForm, setHeaderForm] = useState({ customer: "", issue_date: "", due_date: "", currency_code: "USD", ar_account: "", notes: "" });
  const [lineDrafts, setLineDrafts] = useState<InvoiceLineDraft[]>([]);
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [savingHeader, setSavingHeader] = useState(false);
  const [savingLines, setSavingLines] = useState(false);

  const canPost = !!access?.permissions.includes("accounting.post");
  const canEditDraft = !!(canPost && invoice?.status === "draft");

  const loadDetail = useCallback(async (companyId: string) => {
    setLoadingPage(true);
    try {
      const [invoiceData, accountData, customerData] = await Promise.all([
        fetchInvoice(companyId, invoiceId),
        fetchAccounts(companyId),
        fetchContacts(companyId, { type: "customer" }),
      ]);
      setInvoice(invoiceData);
      setAccounts(accountData);
      setCustomers(customerData);
      setHeaderForm({ customer: invoiceData.customer, issue_date: invoiceData.issue_date, due_date: invoiceData.due_date || "", currency_code: invoiceData.currency_code, ar_account: invoiceData.ar_account, notes: invoiceData.notes || "" });
      setLineDrafts(invoiceData.lines.map((l) => ({ localId: l.id, description: l.description, quantity: l.quantity, unit_price: l.unit_price, revenue_account_id: l.revenue_account })));
    } finally {
      setLoadingPage(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    if (!activeCompany) return;
    void loadDetail(activeCompany.id);
  }, [activeCompany, loadDetail]);

  async function handleHeaderSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeCompany || !invoice || !canEditDraft) return;
    setFormError(""); setInfoMessage(""); setSavingHeader(true);
    try {
      await updateInvoice(activeCompany.id, invoice.id, { customer: headerForm.customer, issue_date: headerForm.issue_date, due_date: headerForm.due_date || undefined, currency_code: headerForm.currency_code || "USD", notes: headerForm.notes || undefined, ar_account: headerForm.ar_account });
      await loadDetail(activeCompany.id);
      setInfoMessage("Header saved.");
    } catch (err) {
      setFormError(err instanceof ApiError ? `Save failed (${err.status}).` : "Save failed.");
    } finally {
      setSavingHeader(false);
    }
  }

  async function handleLinesSave() {
    if (!activeCompany || !invoice || !canEditDraft) return;
    setFormError(""); setInfoMessage("");
    if (!lineDrafts.length) { setFormError("At least one line is required."); return; }
    setSavingLines(true);
    try {
      await replaceInvoiceLines(activeCompany.id, invoice.id, lineDrafts.map((l, idx) => ({ line_no: idx + 1, description: l.description, quantity: l.quantity, unit_price: l.unit_price, revenue_account_id: l.revenue_account_id })));
      await loadDetail(activeCompany.id);
      setInfoMessage("Lines saved.");
    } catch (err) {
      setFormError(err instanceof ApiError ? `Save lines failed (${err.status}).` : "Save lines failed.");
    } finally {
      setSavingLines(false);
    }
  }

  async function handlePost() {
    if (!activeCompany || !invoice || !canPost) return;
    setActionError(""); setInfoMessage("");
    try {
      await postInvoice(activeCompany.id, invoice.id);
      await loadDetail(activeCompany.id);
      setInfoMessage("Invoice posted.");
    } catch (err) {
      setActionError(err instanceof ApiError ? `Post failed (${err.status}).` : "Post failed.");
    }
  }

  async function handleVoid() {
    if (!activeCompany || !invoice || !canPost) return;
    setActionError(""); setInfoMessage("");
    try {
      await voidInvoice(activeCompany.id, invoice.id);
      await loadDetail(activeCompany.id);
      setInfoMessage("Invoice voided.");
    } catch (err) {
      setActionError(err instanceof ApiError ? `Void failed (${err.status}).` : "Void failed.");
    }
  }

  function handlePrint() {
    if (!invoice || !activeCompany) return;
    const customerName = customers.find((customer) => customer.id === invoice.customer)?.name || invoice.customer;
    const opened = printInvoice({
      invoice,
      companyName: activeCompany.name,
      customerName,
    });
    if (!opened) {
      setActionError("Unable to open print dialog. Check browser print permissions and try again.");
    }
  }

  const lineTotal = lineDrafts.reduce((sum, l) => sum + parseFloat(l.quantity || "0") * parseFloat(l.unit_price || "0"), 0);

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
        title={invoice ? `Invoice #${invoice.invoice_no ?? "—"}` : "Invoice Detail"}
        description={invoice ? `Issued ${invoice.issue_date}${invoice.due_date ? ` · Due ${invoice.due_date}` : ""}` : ""}
        breadcrumbs={[
          { label: "Sales", href: getCompanyDashboardPath(activeCompany.slug) },
          { label: "Invoices", href: getCompanyInvoicesPath(activeCompany.slug) },
          { label: "Detail" },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {invoice && <StatusBadge status={invoice.status} />}
            <Button variant="outline" size="sm" onClick={handlePrint} disabled={!invoice}>
              <Printer className="mr-1.5 h-3.5 w-3.5" /> Print / PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleNavigate(getCompanyInvoicesPath(activeCompany.slug))}>
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back
            </Button>
            {canPost && invoice?.status === "draft" && (
              <Button size="sm" onClick={handlePost}>Post Invoice</Button>
            )}
            {canPost && invoice && ["posted", "partially_paid"].includes(invoice.status) && (
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

      {loadingPage || !invoice ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="space-y-5">
          {/* Header */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-foreground">Invoice Details</h2>
            <form className="grid gap-4" onSubmit={handleHeaderSave}>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="grid gap-1.5">
                  <Label>Customer</Label>
                  <Select value={headerForm.customer} onValueChange={(v) => setHeaderForm((p) => ({ ...p, customer: v }))} disabled={!canEditDraft}>
                    <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                    <SelectContent>
                      {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Issue Date</Label>
                  <Input type="date" value={headerForm.issue_date} onChange={(e) => setHeaderForm((p) => ({ ...p, issue_date: e.target.value }))} disabled={!canEditDraft} required />
                </div>
                <div className="grid gap-1.5">
                  <Label>Due Date</Label>
                  <Input type="date" value={headerForm.due_date} onChange={(e) => setHeaderForm((p) => ({ ...p, due_date: e.target.value }))} disabled={!canEditDraft} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="grid gap-1.5">
                  <Label>Currency</Label>
                  <Input value={headerForm.currency_code} onChange={(e) => setHeaderForm((p) => ({ ...p, currency_code: e.target.value }))} disabled={!canEditDraft} maxLength={3} />
                </div>
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label>AR Account</Label>
                  <Select value={headerForm.ar_account} onValueChange={(v) => setHeaderForm((p) => ({ ...p, ar_account: v }))} disabled={!canEditDraft}>
                    <SelectTrigger><SelectValue placeholder="Select AR account" /></SelectTrigger>
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

          {/* Lines */}
          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">Invoice Lines</h2>
              {canEditDraft && (
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => setLineDrafts((prev) => [...prev, newLineDraft(accounts)])}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Line
                  </Button>
                  <Button type="button" size="sm" onClick={handleLinesSave} disabled={savingLines}>
                    {savingLines && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />} Save Lines
                  </Button>
                </div>
              )}
            </div>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/20 hover:bg-muted/20">
                  <TableHead className="font-semibold text-xs">Description</TableHead>
                  <TableHead className="font-semibold text-xs text-right w-20">Qty</TableHead>
                  <TableHead className="font-semibold text-xs text-right w-28">Unit Price</TableHead>
                  <TableHead className="font-semibold text-xs">Revenue Account</TableHead>
                  {canEditDraft && <TableHead className="w-20"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineDrafts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">No lines yet. Add a line to get started.</TableCell>
                  </TableRow>
                ) : (
                  lineDrafts.map((line, idx) => (
                    <TableRow key={line.localId}>
                      <TableCell>
                        <Input className="h-8 text-sm" value={line.description} onChange={(e) => setLineDrafts((prev) => prev.map((l, i) => i === idx ? { ...l, description: e.target.value } : l))} disabled={!canEditDraft} placeholder="Description" />
                      </TableCell>
                      <TableCell>
                        <Input className="h-8 text-sm text-right" value={line.quantity} onChange={(e) => setLineDrafts((prev) => prev.map((l, i) => i === idx ? { ...l, quantity: e.target.value } : l))} disabled={!canEditDraft} />
                      </TableCell>
                      <TableCell>
                        <Input className="h-8 text-sm text-right" value={line.unit_price} onChange={(e) => setLineDrafts((prev) => prev.map((l, i) => i === idx ? { ...l, unit_price: e.target.value } : l))} disabled={!canEditDraft} />
                      </TableCell>
                      <TableCell>
                        <Select value={line.revenue_account_id} onValueChange={(v) => setLineDrafts((prev) => prev.map((l, i) => i === idx ? { ...l, revenue_account_id: v } : l))} disabled={!canEditDraft}>
                          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      {canEditDraft && (
                        <TableCell>
                          <Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-destructive hover:text-destructive" onClick={() => setLineDrafts((prev) => prev.filter((_, i) => i !== idx))}>
                            Remove
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
              {lineDrafts.length > 0 && (
                <TableFooter>
                  <TableRow className="bg-muted/20">
                    <TableCell colSpan={2} className="text-sm font-semibold">Total</TableCell>
                    <TableCell className="text-sm font-semibold tabular-nums text-right">{fmt(lineTotal)}</TableCell>
                    <TableCell colSpan={canEditDraft ? 2 : 1} />
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </div>
        </div>
      )}
    </AppShell>
  );
}
