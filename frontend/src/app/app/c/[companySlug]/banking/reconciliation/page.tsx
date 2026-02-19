"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ChevronRight, Loader2, Plus } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { ApiError, createReconciliation, fetchBankAccounts, fetchReconciliations } from "@/lib/api-client";
import type { BankAccount, BankReconciliation } from "@/lib/api-types";
import { getCompanyReconciliationDetailPath } from "@/lib/company-routing";
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

export default function ReconciliationPage() {
  const params = useParams<{ companySlug: string }>();
  const companySlug = params.companySlug;
  const { isLoading, error, user, companies, activeCompany, access, handleNavigate, handleLogout } =
    useCompanyContext(companySlug);

  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [reconciliations, setReconciliations] = useState<BankReconciliation[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [formError, setFormError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    bank_account: "",
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date().toISOString().slice(0, 10),
    opening_balance: "0.00",
    closing_balance: "0.00",
  });

  const canPost = !!access?.permissions.includes("accounting.post");

  async function loadData(companyId: string) {
    setLoadingData(true);
    try {
      const [bankAccountData, reconciliationData] = await Promise.all([
        fetchBankAccounts(companyId),
        fetchReconciliations(companyId),
      ]);
      setBankAccounts(bankAccountData);
      setReconciliations(reconciliationData);
      setForm((prev) => ({
        ...prev,
        bank_account: prev.bank_account || bankAccountData[0]?.id || "",
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
      await createReconciliation(activeCompany.id, form);
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
        title="Reconciliation"
        description="Create reconciliation periods and finalize selected transactions."
        breadcrumbs={[{ label: "Banking" }, { label: "Reconciliation" }]}
        actions={
          canPost && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> New Reconciliation
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>New Reconciliation Period</DialogTitle>
                </DialogHeader>
                <form className="mt-2 grid gap-3" onSubmit={handleCreate}>
                  <div className="grid gap-1.5">
                    <Label>Bank Account</Label>
                    <Select value={form.bank_account} onValueChange={(v) => setForm((p) => ({ ...p, bank_account: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select bank account" /></SelectTrigger>
                      <SelectContent>
                        {bankAccounts.map((ba) => (
                          <SelectItem key={ba.id} value={ba.id}>{ba.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1.5">
                      <Label>Start Date</Label>
                      <Input type="date" value={form.start_date} onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))} required />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>End Date</Label>
                      <Input type="date" value={form.end_date} onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))} required />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1.5">
                      <Label>Opening Balance</Label>
                      <Input value={form.opening_balance} onChange={(e) => setForm((p) => ({ ...p, opening_balance: e.target.value }))} placeholder="0.00" required />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Closing Balance</Label>
                      <Input value={form.closing_balance} onChange={(e) => setForm((p) => ({ ...p, closing_balance: e.target.value }))} placeholder="0.00" required />
                    </div>
                  </div>
                  {formError && <p className="text-sm text-destructive">{formError}</p>}
                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={submitting || !form.bank_account}>
                      {submitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />} Create
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )
        }
      />

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="font-semibold text-xs">Bank Account</TableHead>
              <TableHead className="font-semibold text-xs">Period</TableHead>
              <TableHead className="font-semibold text-xs">Status</TableHead>
              <TableHead className="font-semibold text-xs w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingData ? (
              <TableRow>
                <TableCell colSpan={4} className="py-12 text-center">
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                  </div>
                </TableCell>
              </TableRow>
            ) : reconciliations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-12 text-center">
                  <p className="text-sm text-muted-foreground">No reconciliation periods yet.</p>
                </TableCell>
              </TableRow>
            ) : (
              reconciliations.map((rec) => (
                <TableRow
                  key={rec.id}
                  className="cursor-pointer hover:bg-muted/30"
                  onClick={() => handleNavigate(getCompanyReconciliationDetailPath(activeCompany.slug, rec.id))}
                >
                  <TableCell className="text-sm font-medium">{rec.bank_account}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{rec.start_date} — {rec.end_date}</TableCell>
                  <TableCell><StatusBadge status={rec.status} /></TableCell>
                  <TableCell>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
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
