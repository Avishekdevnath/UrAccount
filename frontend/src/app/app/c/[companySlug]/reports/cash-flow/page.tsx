"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { fetchCashFlow } from "@/lib/api-client";
import type { CashFlowReport } from "@/lib/api-types";
import { useCompanyContext } from "@/lib/use-company-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function fmt(value: string | null | undefined): string {
  if (!value) return "—";
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
}

const today = new Date();
const defaultStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
const defaultEnd = today.toISOString().slice(0, 10);

export default function CashFlowPage() {
  const params = useParams<{ companySlug: string }>();
  const companySlug = params.companySlug;
  const { isLoading, error, user, companies, activeCompany, access, handleNavigate, handleLogout } =
    useCompanyContext(companySlug);
  const [report, setReport] = useState<CashFlowReport | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [filters, setFilters] = useState({ start_date: defaultStart, end_date: defaultEnd });

  async function loadReport(companyId: string, startDate: string, endDate: string) {
    setLoadingReport(true);
    try {
      const data = await fetchCashFlow(companyId, { start_date: startDate, end_date: endDate });
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

  const netNum = report ? parseFloat(report.net_cash_movement) : null;
  const isPositive = netNum !== null && netNum >= 0;

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
        title="Cash Flow"
        description="Cash inflow, outflow, and net movement over a date range."
        breadcrumbs={[{ label: "Reports" }, { label: "Cash Flow" }]}
        actions={
          <form onSubmit={handleRefresh} className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">From</Label>
            <Input type="date" value={filters.start_date} onChange={(e) => setFilters((p) => ({ ...p, start_date: e.target.value }))} className="h-8 w-36 text-sm" />
            <Label className="text-xs text-muted-foreground">To</Label>
            <Input type="date" value={filters.end_date} onChange={(e) => setFilters((p) => ({ ...p, end_date: e.target.value }))} className="h-8 w-36 text-sm" />
            <Button type="submit" size="sm" variant="outline">
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Run
            </Button>
          </form>
        }
      />

      {loadingReport ? (
        <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading report…
        </div>
      ) : !report ? null : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Cash Inflow</p>
            <p className="mt-3 text-3xl font-bold tabular-nums text-emerald-700">{fmt(report.cash_inflow)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{report.start_date} — {report.end_date}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Cash Outflow</p>
            <p className="mt-3 text-3xl font-bold tabular-nums text-red-600">{fmt(report.cash_outflow)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{report.start_date} — {report.end_date}</p>
          </div>
          <div className={`rounded-xl border p-6 shadow-sm ${isPositive ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Net Movement</p>
            <p className={`mt-3 text-3xl font-bold tabular-nums ${isPositive ? "text-emerald-700" : "text-red-600"}`}>{fmt(report.net_cash_movement)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{report.start_date} — {report.end_date}</p>
          </div>
        </div>
      )}
    </AppShell>
  );
}
