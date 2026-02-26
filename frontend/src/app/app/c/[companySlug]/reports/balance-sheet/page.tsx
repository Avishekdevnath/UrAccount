"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, Printer, RefreshCw } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { fetchBalanceSheet } from "@/lib/api-client";
import type { BalanceSheetReport } from "@/lib/api-types";
import { printBalanceSheetReport } from "@/lib/print/reports";
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

function fmt(value: string | null | undefined): string {
  if (!value) return "—";
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
}

const SECTION_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  asset:     { label: "Assets",      color: "text-blue-800",   bg: "bg-blue-50/60 border-blue-200/60" },
  liability: { label: "Liabilities", color: "text-orange-800", bg: "bg-orange-50/60 border-orange-200/60" },
  equity:    { label: "Equity",      color: "text-violet-800", bg: "bg-violet-50/60 border-violet-200/60" },
};

export default function BalanceSheetPage() {
  const params = useParams<{ companySlug: string }>();
  const companySlug = params.companySlug;
  const { isLoading, error, user, companies, activeCompany, access, handleNavigate, handleLogout } =
    useCompanyContext(companySlug);
  const [report, setReport] = useState<BalanceSheetReport | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10));

  async function loadReport(companyId: string, asOfDate: string) {
    setLoadingReport(true);
    try {
      const data = await fetchBalanceSheet(companyId, asOfDate);
      setReport(data);
    } finally {
      setLoadingReport(false);
    }
  }

  useEffect(() => {
    if (!activeCompany) return;
    void loadReport(activeCompany.id, asOf);
  }, [activeCompany, asOf]);

  async function handleRefresh(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeCompany) return;
    await loadReport(activeCompany.id, asOf);
  }

  function handlePrint() {
    if (!activeCompany || !report) return;
    void printBalanceSheetReport({ companyName: activeCompany.name, report });
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

  const sections = ["asset", "liability", "equity"] as const;

  return (
    <AppShell user={user} companies={companies} activeCompany={activeCompany} access={access} onLogout={handleLogout} onNavigate={handleNavigate}>
      <PageHeader
        title="Balance Sheet"
        description="Assets, liabilities, and equity as of a specific date."
        breadcrumbs={[{ label: "Reports" }, { label: "Balance Sheet" }]}
        actions={
          <form onSubmit={handleRefresh} className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">As of</Label>
            <Input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} className="h-8 w-36 text-sm" />
            <Button type="submit" size="sm" variant="outline">
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Run
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={handlePrint} disabled={!report}>
              <Printer className="mr-1.5 h-3.5 w-3.5" /> Print / PDF
            </Button>
          </form>
        }
      />

      {report && (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground">Total Assets</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-blue-700">{fmt(report.asset_total)}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground">Total Liabilities</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-orange-700">{fmt(report.liability_total)}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground">Total Equity</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-violet-700">{fmt(report.equity_total)}</p>
          </div>
          <div className="rounded-xl border border-border bg-muted/60 p-4 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground">Liab + Equity</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{fmt(report.liability_plus_equity_total)}</p>
          </div>
        </div>
      )}

      {loadingReport ? (
        <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading report…
        </div>
      ) : !report ? null : (
        <div className="space-y-4">
          {sections.map((type) => {
            const style = SECTION_STYLES[type];
            const rows = report.rows.filter((r) => r.account_type === type);
            const total = type === "asset" ? report.asset_total : type === "liability" ? report.liability_total : report.equity_total;
            return (
              <div key={type} className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                <div className={`px-4 py-3 border-b border-border ${style.bg}`}>
                  <h2 className={`text-sm font-semibold ${style.color}`}>{style.label}</h2>
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
                    {rows.map((row) => (
                      <TableRow key={row.account_id}>
                        <TableCell className="font-mono text-sm text-muted-foreground">{row.account_code}</TableCell>
                        <TableCell className="text-sm">{row.account_name}</TableCell>
                        <TableCell className="text-sm text-right tabular-nums font-medium">{fmt(row.balance)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow className={style.bg}>
                      <TableCell colSpan={2} className={`text-sm font-semibold ${style.color}`}>Total {style.label}</TableCell>
                      <TableCell className={`text-sm text-right tabular-nums font-semibold ${style.color}`}>{fmt(total)}</TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
