"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { fetchTrialBalance } from "@/lib/api-client";
import type { TrialBalanceRow } from "@/lib/api-types";
import { useCompanyContext } from "@/lib/use-company-context";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function fmt(value: number): string {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

export default function TrialBalancePage() {
  const params = useParams<{ companySlug: string }>();
  const companySlug = params.companySlug;
  const { isLoading, error, user, companies, activeCompany, access, handleNavigate, handleLogout } =
    useCompanyContext(companySlug);
  const [rows, setRows] = useState<TrialBalanceRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);

  useEffect(() => {
    if (!activeCompany) return;
    const companyId = activeCompany.id;
    async function loadTrialBalance() {
      setLoadingRows(true);
      try {
        const data = await fetchTrialBalance(companyId);
        setRows(data);
      } finally {
        setLoadingRows(false);
      }
    }
    void loadTrialBalance();
  }, [activeCompany]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.debit += toNumber(row.total_debit);
        acc.credit += toNumber(row.total_credit);
        return acc;
      },
      { debit: 0, credit: 0 }
    );
  }, [rows]);

  const isBalanced = Math.abs(totals.debit - totals.credit) < 0.01;

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
        description="Posted ledger totals by account."
        breadcrumbs={[{ label: "Accounting" }, { label: "Trial Balance" }]}
        actions={
          isBalanced && rows.length > 0 ? (
            <span className="inline-flex items-center rounded px-2.5 py-1 text-xs font-medium bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200">
              Balanced
            </span>
          ) : rows.length > 0 ? (
            <span className="inline-flex items-center rounded px-2.5 py-1 text-xs font-medium bg-red-50 text-red-700 ring-1 ring-inset ring-red-200">
              Out of Balance
            </span>
          ) : null
        }
      />

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-24 font-semibold text-xs">Code</TableHead>
              <TableHead className="font-semibold text-xs">Account</TableHead>
              <TableHead className="font-semibold text-xs text-right">Debit</TableHead>
              <TableHead className="font-semibold text-xs text-right">Credit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingRows ? (
              <TableRow>
                <TableCell colSpan={4} className="py-12 text-center">
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading trial balance…
                  </div>
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-12 text-center">
                  <p className="text-sm text-muted-foreground">No posted entries yet.</p>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.account__id}>
                  <TableCell className="font-mono text-sm text-muted-foreground">{row.account__code}</TableCell>
                  <TableCell className="text-sm">{row.account__name}</TableCell>
                  <TableCell className="text-sm text-right tabular-nums">{fmt(toNumber(row.total_debit))}</TableCell>
                  <TableCell className="text-sm text-right tabular-nums">{fmt(toNumber(row.total_credit))}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          {rows.length > 0 && (
            <TableFooter>
              <TableRow className="font-semibold bg-muted/40">
                <TableCell colSpan={2} className="text-sm">Total</TableCell>
                <TableCell className="text-sm text-right tabular-nums">{fmt(totals.debit)}</TableCell>
                <TableCell className="text-sm text-right tabular-nums">{fmt(totals.credit)}</TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </AppShell>
  );
}
