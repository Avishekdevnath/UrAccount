"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { fetchReportTrialBalance } from "@/lib/api-client";
import type { ReportTrialBalance } from "@/lib/api-types";
import { useCompanyContext } from "@/lib/use-company-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function fmt(value: string | null | undefined): string {
  if (!value) return "—";
  const num = parseFloat(value);
  if (isNaN(num) || num === 0) return "—";
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
}

function fmtTotal(num: number): string {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
}

export default function ReportTrialBalancePage() {
  const params = useParams<{ companySlug: string }>();
  const companySlug = params.companySlug;
  const { isLoading, error, user, companies, activeCompany, access, handleNavigate, handleLogout } =
    useCompanyContext(companySlug);
  const [report, setReport] = useState<ReportTrialBalance | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [filters, setFilters] = useState({
    start_date: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().slice(0, 10),
    end_date: new Date().toISOString().slice(0, 10),
  });

  async function loadReport(companyId: string, startDate: string, endDate: string) {
    setLoadingReport(true);
    try {
      const data = await fetchReportTrialBalance(companyId, { start_date: startDate, end_date: endDate });
      setReport(data);
    } finally {
      setLoadingReport(false);
    }
  }

  useEffect(() => {
    if (!activeCompany) return;
    void loadReport(activeCompany.id, filters.start_date, filters.end_date);
  }, [activeCompany, filters.end_date, filters.start_date]);

  async function handleRefresh(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeCompany) return;
    await loadReport(activeCompany.id, filters.start_date, filters.end_date);
  }

  const totalDebit = report?.rows.reduce((sum, r) => sum + parseFloat(r.total_debit || "0"), 0) ?? 0;
  const totalCredit = report?.rows.reduce((sum, r) => sum + parseFloat(r.total_credit || "0"), 0) ?? 0;
  const isBalanced = report ? Math.abs(totalDebit - totalCredit) < 0.01 : null;

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
        title="Trial Balance"
        description="Debit and credit totals by account for a date range."
        breadcrumbs={[{ label: "Reports" }, { label: "Trial Balance" }]}
        actions={
          <div className="flex items-center gap-3">
            {isBalanced !== null && (
              <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${isBalanced ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-red-50 text-red-700 ring-red-200"}`}>
                {isBalanced ? "Balanced" : "Out of Balance"}
              </span>
            )}
            <form onSubmit={handleRefresh} className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">From</Label>
              <Input type="date" value={filters.start_date} onChange={(e) => setFilters((p) => ({ ...p, start_date: e.target.value }))} className="h-8 w-36 text-sm" />
              <Label className="text-xs text-muted-foreground">To</Label>
              <Input type="date" value={filters.end_date} onChange={(e) => setFilters((p) => ({ ...p, end_date: e.target.value }))} className="h-8 w-36 text-sm" />
              <Button type="submit" size="sm" variant="outline">
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Run
              </Button>
            </form>
          </div>
        }
      />

      {loadingReport ? (
        <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading report…
        </div>
      ) : !report ? null : (
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="font-semibold text-xs w-24">Code</TableHead>
                <TableHead className="font-semibold text-xs">Account</TableHead>
                <TableHead className="font-semibold text-xs text-right">Debit</TableHead>
                <TableHead className="font-semibold text-xs text-right">Credit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.rows.map((row) => (
                <TableRow key={row.account_id}>
                  <TableCell className="font-mono text-sm text-muted-foreground">{row.account_code}</TableCell>
                  <TableCell className="text-sm">{row.account_name}</TableCell>
                  <TableCell className="text-sm text-right tabular-nums text-blue-700">{fmt(row.total_debit)}</TableCell>
                  <TableCell className="text-sm text-right tabular-nums text-orange-700">{fmt(row.total_credit)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow className="bg-muted/40">
                <TableCell colSpan={2} className="text-sm font-semibold">Totals</TableCell>
                <TableCell className={`text-sm text-right tabular-nums font-semibold ${isBalanced ? "text-emerald-700" : "text-red-600"}`}>
                  {fmtTotal(totalDebit)}
                </TableCell>
                <TableCell className={`text-sm text-right tabular-nums font-semibold ${isBalanced ? "text-emerald-700" : "text-red-600"}`}>
                  {fmtTotal(totalCredit)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}
    </AppShell>
  );
}
