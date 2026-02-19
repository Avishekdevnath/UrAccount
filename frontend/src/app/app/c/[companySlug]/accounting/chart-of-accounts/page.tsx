"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, Plus } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { ApiError, createAccount, fetchAccounts } from "@/lib/api-client";
import type { Account } from "@/lib/api-types";
import { useCompanyContext } from "@/lib/use-company-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
import { Badge } from "@/components/ui/badge";

const ACCOUNT_TYPE_COLORS: Record<Account["type"], string> = {
  asset:     "bg-blue-50 text-blue-700 border-blue-200",
  liability: "bg-orange-50 text-orange-700 border-orange-200",
  equity:    "bg-violet-50 text-violet-700 border-violet-200",
  income:    "bg-emerald-50 text-emerald-700 border-emerald-200",
  expense:   "bg-red-50 text-red-700 border-red-200",
};

export default function ChartOfAccountsPage() {
  const params = useParams<{ companySlug: string }>();
  const companySlug = params.companySlug;
  const { isLoading, error, user, companies, activeCompany, access, handleNavigate, handleLogout } =
    useCompanyContext(companySlug);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [formError, setFormError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    code: "",
    name: "",
    type: "asset" as Account["type"],
    normal_balance: "debit" as Account["normal_balance"],
  });

  const canPost = !!access?.permissions.includes("accounting.post");

  async function loadAccounts(companyId: string) {
    setLoadingAccounts(true);
    try {
      const data = await fetchAccounts(companyId);
      setAccounts(data);
    } finally {
      setLoadingAccounts(false);
    }
  }

  useEffect(() => {
    if (!activeCompany) return;
    void loadAccounts(activeCompany.id);
  }, [activeCompany]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeCompany || !canPost) return;
    setFormError("");
    setSubmitting(true);
    try {
      await createAccount(activeCompany.id, { ...form, is_active: true });
      setForm({ code: "", name: "", type: "asset", normal_balance: "debit" });
      setDialogOpen(false);
      await loadAccounts(activeCompany.id);
    } catch (err) {
      setFormError(err instanceof ApiError ? `Create failed (${err.status}).` : "Create failed.");
    } finally {
      setSubmitting(false);
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
        title="Chart of Accounts"
        description="Manage the account structure for this company."
        breadcrumbs={[{ label: "Accounting" }, { label: "Chart of Accounts" }]}
        actions={
          <Button size="sm" onClick={() => setDialogOpen(true)} disabled={!canPost}>
            <Plus className="mr-1.5 h-4 w-4" /> New Account
          </Button>
        }
      />

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-24 font-semibold text-xs">Code</TableHead>
              <TableHead className="font-semibold text-xs">Name</TableHead>
              <TableHead className="font-semibold text-xs">Type</TableHead>
              <TableHead className="font-semibold text-xs">Normal Balance</TableHead>
              <TableHead className="font-semibold text-xs">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingAccounts ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center">
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading accounts…
                  </div>
                </TableCell>
              </TableRow>
            ) : accounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center">
                  <p className="text-sm text-muted-foreground">No accounts yet.</p>
                </TableCell>
              </TableRow>
            ) : (
              accounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell className="font-mono text-sm font-medium text-muted-foreground">{account.code}</TableCell>
                  <TableCell className="text-sm font-medium">{account.name}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ring-1 ring-inset capitalize ${ACCOUNT_TYPE_COLORS[account.type]}`}>
                      {account.type}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm capitalize text-muted-foreground">{account.normal_balance}</TableCell>
                  <TableCell>
                    <StatusBadge status={account.is_active ? "active" : "inactive"} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New Account</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Code <span className="text-destructive">*</span></Label>
              <Input value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))} placeholder="e.g. 1000" required />
            </div>
            <div className="space-y-1.5">
              <Label>Name <span className="text-destructive">*</span></Label>
              <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Cash and Cash Equivalents" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm((p) => ({ ...p, type: v as Account["type"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asset">Asset</SelectItem>
                    <SelectItem value="liability">Liability</SelectItem>
                    <SelectItem value="equity">Equity</SelectItem>
                    <SelectItem value="income">Income</SelectItem>
                    <SelectItem value="expense">Expense</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Normal Balance</Label>
                <Select value={form.normal_balance} onValueChange={(v) => setForm((p) => ({ ...p, normal_balance: v as Account["normal_balance"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="debit">Debit</SelectItem>
                    <SelectItem value="credit">Credit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {formError && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
                <p className="text-sm text-destructive">{formError}</p>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting || !form.code || !form.name}>
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating…</> : "Create Account"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
