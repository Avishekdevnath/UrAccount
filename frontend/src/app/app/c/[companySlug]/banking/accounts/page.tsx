"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { ApiError, createBankAccount, deleteBankAccount, fetchAccounts, fetchBankAccounts } from "@/lib/api-client";
import type { Account, BankAccount } from "@/lib/api-types";
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

export default function BankingAccountsPage() {
  const params = useParams<{ companySlug: string }>();
  const companySlug = params.companySlug;
  const { isLoading, error, user, companies, activeCompany, access, handleNavigate, handleLogout } =
    useCompanyContext(companySlug);

  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    account_number_last4: "",
    currency_code: "USD",
    ledger_account: "",
    is_active: true,
  });

  const canPost = !!access?.permissions.includes("accounting.post");

  async function loadData(companyId: string) {
    setLoadingData(true);
    try {
      const [bankAccountData, ledgerAccounts] = await Promise.all([
        fetchBankAccounts(companyId),
        fetchAccounts(companyId),
      ]);
      setBankAccounts(bankAccountData);
      setAccounts(ledgerAccounts);
      setForm((prev) => ({
        ...prev,
        ledger_account: prev.ledger_account || ledgerAccounts[0]?.id || "",
      }));
    } finally {
      setLoadingData(false);
    }
  }

  useEffect(() => {
    if (!activeCompany) return;
    void loadData(activeCompany.id);
  }, [activeCompany]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeCompany || !canPost) return;
    setFormError("");
    setSubmitting(true);
    try {
      await createBankAccount(activeCompany.id, form);
      setForm((prev) => ({ ...prev, name: "", account_number_last4: "" }));
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

  async function handleDelete(bankAccountId: string) {
    if (!activeCompany || !canPost) return;
    if (!window.confirm("Delete this bank account?")) return;
    setActionError("");
    try {
      await deleteBankAccount(activeCompany.id, bankAccountId);
      await loadData(activeCompany.id);
    } catch (err) {
      if (err instanceof ApiError) {
        setActionError((err.payload as { detail?: string })?.detail || `Delete failed (${err.status}).`);
      } else {
        setActionError("Delete failed.");
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
        title="Bank Accounts"
        description="Manage company bank accounts linked to ledger accounts."
        breadcrumbs={[{ label: "Banking" }, { label: "Accounts" }]}
        actions={
          canPost && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Bank Account
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Add Bank Account</DialogTitle>
                </DialogHeader>
                <form className="mt-2 grid gap-3" onSubmit={handleCreate}>
                  <div className="grid gap-1.5">
                    <Label>Name</Label>
                    <Input
                      placeholder="e.g. Chase Checking"
                      value={form.name}
                      onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1.5">
                      <Label>Last 4 digits</Label>
                      <Input
                        placeholder="1234"
                        maxLength={4}
                        value={form.account_number_last4}
                        onChange={(e) => setForm((p) => ({ ...p, account_number_last4: e.target.value }))}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Currency</Label>
                      <Input
                        placeholder="USD"
                        maxLength={3}
                        value={form.currency_code}
                        onChange={(e) => setForm((p) => ({ ...p, currency_code: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Ledger Account</Label>
                    <Select value={form.ledger_account} onValueChange={(v) => setForm((p) => ({ ...p, ledger_account: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                      <SelectContent>
                        {accounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {formError && <p className="text-sm text-destructive">{formError}</p>}
                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={submitting || !form.ledger_account}>
                      {submitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />} Add Account
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
              <TableHead className="font-semibold text-xs">Name</TableHead>
              <TableHead className="font-semibold text-xs">Last 4</TableHead>
              <TableHead className="font-semibold text-xs">Currency</TableHead>
              <TableHead className="font-semibold text-xs">Ledger Account</TableHead>
              <TableHead className="font-semibold text-xs">Active</TableHead>
              {canPost && <TableHead className="font-semibold text-xs w-20"></TableHead>}
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
            ) : bankAccounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center">
                  <p className="text-sm text-muted-foreground">No bank accounts yet.</p>
                </TableCell>
              </TableRow>
            ) : (
              bankAccounts.map((ba) => (
                <TableRow key={ba.id}>
                  <TableCell className="text-sm font-medium">{ba.name}</TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">{ba.account_number_last4 || "—"}</TableCell>
                  <TableCell className="text-sm">{ba.currency_code}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{ba.ledger_account}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${ba.is_active ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-gray-50 text-gray-500 ring-gray-200"}`}>
                      {ba.is_active ? "Active" : "Inactive"}
                    </span>
                  </TableCell>
                  {canPost && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => void handleDelete(ba.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </AppShell>
  );
}
