"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, Printer, RefreshCw } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { fetchProfitLoss } from "@/lib/api-client";
import type { ProfitLossReport } from "@/lib/api-types";
import { printProfitLossReport } from "@/lib/print/reports";
import { useCompanyContext } from "@/lib/use-company-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";

function fmt(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "—";
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
}

const today = new Date();
const defaultStart = new Date(today.getFullYear(), 0, 1).toISOString().slice(0, 10);
const defaultEnd = today.toISOString().slice(0, 10);

export default function ProfitLossPage() {
  const params = useParams<{ companySlug: string }>();
  const companySlug = params.companySlug;
  const { isLoading, error, user, companies, activeCompany, access, handleNavigate, handleLogout } =
    useCompanyContext(companySlug);
  const [report, setReport] = useState<ProfitLossReport | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [filters, setFilters] = useState({ start_date: defaultStart, end_date: defaultEnd });

  async function loadReport(companyId: string, startDate: string, endDate: string) {
    setLoadingReport(true);
    try {
      const data = await fetchProfitLoss(companyId, { start_date: startDate, end_date: endDate });
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

  function handlePrint() {
    if (!activeCompany || !report) return;
    void printProfitLossReport({ companyName: activeCompany.name, report });
  }

  const netNum = report ? parseFloat(report.net_profit) : null;
  const isProfit = netNum !== null && netNum >= 0;

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

  const incomeRows = report?.rows.filter((r) => r.account_type === "income") ?? [];
  const expenseRows = report?.rows.filter((r) => r.account_type === "expense") ?? [];

  return (
    <AppShell user={user} companies={companies} activeCompany={activeCompany} access={access} onLogout={handleLogout} onNavigate={handleNavigate}>
      <PageHeader
        title="Profit & Loss"
        description="Income and expense performance over a date range."
        breadcrumbs={[{ label: "Reports" }, { label: "Profit & Loss" }]}
        actions={
          <form onSubmit={handleRefresh} className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">From</Label>
            <Input type="date" value={filters.start_date} onChange={(e) => setFilters((p) => ({ ...p, start_date: e.target.value }))} className="h-8 w-36 text-sm" />
            <Label className="text-xs text-muted-foreground">To</Label>
            <Input type="date" value={filters.end_date} onChange={(e) => setFilters((p) => ({ ...p, end_date: e.target.value }))} className="h-8 w-36 text-sm" />
            <Button type="submit" size="sm" variant="outline">
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Run
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={handlePrint} disabled={!report}>
              <Printer className="mr-1.5 h-3.5 w-3.5" /> Print / PDF
            </Button>
          </form>
        }
      />

      {/* Summary cards */}
      {report && (
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground">Total Income</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-emerald-700">{fmt(report.income_total)}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground">Total Expenses</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-red-600">{fmt(report.expense_total)}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground">Net {isProfit ? "Profit" : "Loss"}</p>
            <p className={`mt-1 text-xl font-semibold tabular-nums ${isProfit ? "text-emerald-700" : "text-red-600"}`}>{fmt(report.net_profit)}</p>
          </div>
        </div>
      )}

      {loadingReport ? (
        <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading report…
        </div>
      ) : !report ? null : (
        <div className="space-y-4">
          {/* Income */}
          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-emerald-50/60">
              <h2 className="text-sm font-semibold text-emerald-800">Income</h2>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/20 hover:bg-muted/20">
                  <TableHead className="font-semibold text-xs w-24">Code</TableHead>
                  <TableHead className="font-semibold text-xs">Account</TableHead>
                  <TableHead className="font-semibold text-xs text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incomeRows.map((row) => (
                  <TableRow key={row.account_id}>
                    <TableCell className="font-mono text-sm text-muted-foreground">{row.account_code}</TableCell>
                    <TableCell className="text-sm">{row.account_name}</TableCell>
                    <TableCell className="text-sm text-right tabular-nums text-emerald-700 font-medium">{fmt(row.balance)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className="bg-emerald-50/40">
                  <TableCell colSpan={2} className="text-sm font-semibold">Total Income</TableCell>
                  <TableCell className="text-sm text-right tabular-nums font-semibold text-emerald-700">{fmt(report.income_total)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>

          {/* Expenses */}
          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-red-50/60">
              <h2 className="text-sm font-semibold text-red-800">Expenses</h2>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/20 hover:bg-muted/20">
                  <TableHead className="font-semibold text-xs w-24">Code</TableHead>
                  <TableHead className="font-semibold text-xs">Account</TableHead>
                  <TableHead className="font-semibold text-xs text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenseRows.map((row) => (
                  <TableRow key={row.account_id}>
                    <TableCell className="font-mono text-sm text-muted-foreground">{row.account_code}</TableCell>
                    <TableCell className="text-sm">{row.account_name}</TableCell>
                    <TableCell className="text-sm text-right tabular-nums text-red-600 font-medium">{fmt(row.balance)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className="bg-red-50/40">
                  <TableCell colSpan={2} className="text-sm font-semibold">Total Expenses</TableCell>
                  <TableCell className="text-sm text-right tabular-nums font-semibold text-red-600">{fmt(report.expense_total)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>

          {/* Net */}
          <div className={`rounded-xl border p-4 shadow-sm ${isProfit ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
            <div className="flex items-center justify-between">
              <span className={`text-sm font-semibold ${isProfit ? "text-emerald-800" : "text-red-800"}`}>Net {isProfit ? "Profit" : "Loss"}</span>
              <span className={`text-xl font-bold tabular-nums ${isProfit ? "text-emerald-700" : "text-red-600"}`}>{fmt(report.net_profit)}</span>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
