"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, Upload } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { ApiError, createBankImport, fetchBankAccounts, fetchBankImports } from "@/lib/api-client";
import type { BankAccount, BankStatementImport } from "@/lib/api-types";
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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function BankingImportsPage() {
  const params = useParams<{ companySlug: string }>();
  const companySlug = params.companySlug;
  const { isLoading, error, user, companies, activeCompany, access, handleNavigate, handleLogout } =
    useCompanyContext(companySlug);

  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [imports, setImports] = useState<BankStatementImport[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    bank_account: "",
    file_name: "statement.csv",
    raw_content: "date,description,amount,reference\n2026-02-20,Deposit,50.00,REF1",
  });

  const canPost = !!access?.permissions.includes("accounting.post");

  async function loadData(companyId: string) {
    setLoadingData(true);
    try {
      const [bankAccountData, importData] = await Promise.all([
        fetchBankAccounts(companyId),
        fetchBankImports(companyId),
      ]);
      setBankAccounts(bankAccountData);
      setImports(importData);
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
      await createBankImport(activeCompany.id, form);
      await loadData(activeCompany.id);
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(`Import failed (${err.status}).`);
      } else {
        setFormError("Import failed.");
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
        title="Bank Imports"
        description="Upload statement CSV content for parsing into bank transactions."
        breadcrumbs={[{ label: "Banking" }, { label: "Imports" }]}
      />

      {/* Import form */}
      {canPost && (
        <div className="mb-6 rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-foreground">New Import</h2>
          <form className="grid gap-4" onSubmit={handleCreate}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Bank Account</Label>
                <Select
                  value={form.bank_account}
                  onValueChange={(v) => setForm((p) => ({ ...p, bank_account: v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Select bank account" /></SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map((ba) => (
                      <SelectItem key={ba.id} value={ba.id}>{ba.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>File Name</Label>
                <Input
                  value={form.file_name}
                  onChange={(e) => setForm((p) => ({ ...p, file_name: e.target.value }))}
                  placeholder="statement.csv"
                  required
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>CSV Content</Label>
              <textarea
                className="min-h-36 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={form.raw_content}
                onChange={(e) => setForm((p) => ({ ...p, raw_content: e.target.value }))}
                placeholder="date,description,amount,reference"
                required
              />
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
            <div>
              <Button type="submit" disabled={submitting || !form.bank_account}>
                {submitting ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                )}
                Parse Import
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Imports table */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="font-semibold text-xs">File</TableHead>
              <TableHead className="font-semibold text-xs">Bank Account</TableHead>
              <TableHead className="font-semibold text-xs">Status</TableHead>
              <TableHead className="font-semibold text-xs">Error</TableHead>
              <TableHead className="font-semibold text-xs">Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingData ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center">
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                  </div>
                </TableCell>
              </TableRow>
            ) : imports.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center">
                  <p className="text-sm text-muted-foreground">No imports yet.</p>
                </TableCell>
              </TableRow>
            ) : (
              imports.map((imp) => (
                <TableRow key={imp.id}>
                  <TableCell className="text-sm font-medium font-mono">{imp.file_name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{imp.bank_account}</TableCell>
                  <TableCell><StatusBadge status={imp.status} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{imp.error_message || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{imp.created_at}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </AppShell>
  );
}
