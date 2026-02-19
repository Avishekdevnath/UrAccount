"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { fetchAPAging } from "@/lib/api-client";
import type { APAgingRow } from "@/lib/api-types";
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
import { cn } from "@/lib/utils";

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function fmt(value: number): string {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

const BUCKET_COLORS: Record<string, string> = {
  "0-30":  "text-emerald-700",
  "31-60": "text-amber-700",
  "61-90": "text-orange-700",
  "90+":   "text-red-700",
};

export default function APAgingPage() {
  const params = useParams<{ companySlug: string }>();
  const companySlug = params.companySlug;
  const { isLoading, error, user, companies, activeCompany, access, handleNavigate, handleLogout } =
    useCompanyContext(companySlug);
  const [rows, setRows] = useState<APAgingRow[]>([]);
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10));
  const [loadingRows, setLoadingRows] = useState(false);

  async function loadRows(companyId: string, asOfDate: string) {
    setLoadingRows(true);
    try {
      const data = await fetchAPAging(companyId, asOfDate || undefined);
      setRows(data);
    } finally {
      setLoadingRows(false);
    }
  }

  useEffect(() => {
    if (!activeCompany) return;
    void loadRows(activeCompany.id, asOf);
  }, [activeCompany, asOf]);

  async function handleRefresh(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeCompany) return;
    await loadRows(activeCompany.id, asOf);
  }

  const bucketTotals = useMemo(() => {
    const summary = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0, total: 0 };
    for (const row of rows) {
      const amount = toNumber(row.open_amount);
      summary[row.bucket] += amount;
      summary.total += amount;
    }
    return summary;
  }, [rows]);

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
        title="AP Aging"
        description="Open bill balances by aging bucket."
        breadcrumbs={[{ label: "Purchases" }, { label: "AP Aging" }]}
        actions={
          <form onSubmit={handleRefresh} className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">As of</Label>
            <Input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} className="h-8 w-36 text-sm" />
            <Button type="submit" size="sm" variant="outline">
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
            </Button>
          </form>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {(["0-30", "31-60", "61-90", "90+"] as const).map((bucket) => (
          <div key={bucket} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground">{bucket} days</p>
            <p className={cn("mt-1 text-lg font-semibold tabular-nums", BUCKET_COLORS[bucket])}>{fmt(bucketTotals[bucket])}</p>
          </div>
        ))}
        <div className="rounded-xl border border-border bg-muted/60 p-4 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground">Total AP</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{fmt(bucketTotals.total)}</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-28 font-semibold text-xs">Bill #</TableHead>
              <TableHead className="font-semibold text-xs">Vendor</TableHead>
              <TableHead className="font-semibold text-xs">Due Date</TableHead>
              <TableHead className="font-semibold text-xs text-right">Age (days)</TableHead>
              <TableHead className="font-semibold text-xs">Bucket</TableHead>
              <TableHead className="font-semibold text-xs text-right">Open Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingRows ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center">
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center">
                  <p className="text-sm text-muted-foreground">No outstanding payables as of this date.</p>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.bill_id}>
                  <TableCell className="font-medium text-sm">{row.bill_no ? `#${row.bill_no}` : "—"}</TableCell>
                  <TableCell className="text-sm">{row.vendor_name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{row.due_date}</TableCell>
                  <TableCell className={cn("text-sm text-right tabular-nums", BUCKET_COLORS[row.bucket])}>{row.age_days}</TableCell>
                  <TableCell>
                    <span className={cn("inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ring-1 ring-inset", {
                      "bg-emerald-50 text-emerald-700 ring-emerald-200": row.bucket === "0-30",
                      "bg-amber-50 text-amber-700 ring-amber-200": row.bucket === "31-60",
                      "bg-orange-50 text-orange-700 ring-orange-200": row.bucket === "61-90",
                      "bg-red-50 text-red-700 ring-red-200": row.bucket === "90+",
                    })}>
                      {row.bucket}
                    </span>
                  </TableCell>
                  <TableCell className={cn("text-sm text-right tabular-nums font-medium", BUCKET_COLORS[row.bucket])}>
                    {fmt(toNumber(row.open_amount))}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          {rows.length > 0 && (
            <TableFooter>
              <TableRow className="font-semibold bg-muted/40">
                <TableCell colSpan={5} className="text-sm">Total</TableCell>
                <TableCell className="text-sm text-right tabular-nums">{fmt(bucketTotals.total)}</TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </AppShell>
  );
}
