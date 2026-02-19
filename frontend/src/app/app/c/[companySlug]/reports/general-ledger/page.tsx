"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { fetchAccounts, fetchGeneralLedgerReport } from "@/lib/api-client";
import type { Account, GeneralLedgerReport } from "@/lib/api-types";
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

function fmt(value: string | null | undefined): string {
  if (!value) return "—";
  const num = parseFloat(value);
  if (isNaN(num) || num === 0) return "—";
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
}

export default function GeneralLedgerReportPage() {
  const params = useParams<{ companySlug: string }>();
  const companySlug = params.companySlug;
  const { isLoading, error, user, companies, activeCompany, access, handleNavigate, handleLogout } =
    useCompanyContext(companySlug);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [report, setReport] = useState<GeneralLedgerReport | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [filters, setFilters] = useState({
    start_date: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().slice(0, 10),
    end_date: new Date().toISOString().slice(0, 10),
    account_id: "",
    limit: "200",
  });

  const loadData = useCallback(async (companyId: string, forceFilters = filters) => {
    setLoadingReport(true);
    try {
      const [reportData, accountData] = await Promise.all([
        fetchGeneralLedgerReport(companyId, {
          start_date: forceFilters.start_date,
          end_date: forceFilters.end_date,
          account_id: forceFilters.account_id || undefined,
          limit: Number(forceFilters.limit) || 200,
        }),
        fetchAccounts(companyId),
      ]);
      setReport(reportData);
      setAccounts(accountData);
    } finally {
      setLoadingReport(false);
    }
  }, [filters]);

  useEffect(() => {
    if (!activeCompany) return;
    void loadData(activeCompany.id);
  }, [activeCompany, loadData]);

  async function handleRefresh(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeCompany) return;
    await loadData(activeCompany.id);
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
        title="General Ledger"
        description="Ledger lines with date range, account filter, and row limit."
        breadcrumbs={[{ label: "Reports" }, { label: "General Ledger" }]}
        actions={
          <form onSubmit={handleRefresh} className="flex flex-wrap items-center gap-2">
            <Label className="text-xs text-muted-foreground">From</Label>
            <Input type="date" value={filters.start_date} onChange={(e) => setFilters((p) => ({ ...p, start_date: e.target.value }))} className="h-8 w-36 text-sm" />
            <Label className="text-xs text-muted-foreground">To</Label>
            <Input type="date" value={filters.end_date} onChange={(e) => setFilters((p) => ({ ...p, end_date: e.target.value }))} className="h-8 w-36 text-sm" />
            <Select value={filters.account_id || "all"} onValueChange={(v) => setFilters((p) => ({ ...p, account_id: v === "all" ? "" : v }))}>
              <SelectTrigger className="h-8 w-44 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All accounts</SelectItem>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input value={filters.limit} onChange={(e) => setFilters((p) => ({ ...p, limit: e.target.value }))} placeholder="Limit" className="h-8 w-20 text-sm" />
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
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="font-semibold text-xs w-20">Entry #</TableHead>
                <TableHead className="font-semibold text-xs w-28">Date</TableHead>
                <TableHead className="font-semibold text-xs">Account</TableHead>
                <TableHead className="font-semibold text-xs">Description</TableHead>
                <TableHead className="font-semibold text-xs text-right">Debit</TableHead>
                <TableHead className="font-semibold text-xs text-right">Credit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center">
                    <p className="text-sm text-muted-foreground">No ledger entries for this period.</p>
                  </TableCell>
                </TableRow>
              ) : (
                report.rows.map((row) => (
                  <TableRow key={row.line_id}>
                    <TableCell className="font-mono text-sm text-muted-foreground">{row.entry_no ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.entry_date}</TableCell>
                    <TableCell className="text-sm">
                      <span className="font-mono text-muted-foreground">{row.account_code}</span>
                      {" "}
                      {row.account_name}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.description || "—"}</TableCell>
                    <TableCell className="text-sm text-right tabular-nums text-blue-700 font-medium">{fmt(row.debit)}</TableCell>
                    <TableCell className="text-sm text-right tabular-nums text-orange-700 font-medium">{fmt(row.credit)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </AppShell>
  );
}
