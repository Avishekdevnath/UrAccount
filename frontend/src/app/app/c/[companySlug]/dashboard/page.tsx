"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  FileText,
  Loader2,
  Receipt,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import {
  fetchInvoices,
  fetchBills,
  fetchARAging,
  fetchAPAging,
  fetchProfitLoss,
} from "@/lib/api-client";
import type { Invoice, Bill, ARAgingRow, APAgingRow } from "@/lib/api-types";
import {
  getCompanyInvoicesPath,
  getCompanyBillsPath,
  getCompanyARAgingPath,
  getCompanyAPAgingPath,
  getCompanyProfitLossPath,
} from "@/lib/company-routing";
import { useCompanyContext } from "@/lib/use-company-context";
import { cn } from "@/lib/utils";

type DashboardData = {
  invoices: Invoice[];
  bills: Bill[];
  arAging: ARAgingRow[];
  apAging: APAgingRow[];
  netProfit: string | null;
};

function formatCurrency(value: string | number | null | undefined, currency = "USD"): string {
  if (value === null || value === undefined) return "—";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

type StatCardProps = {
  title: string;
  value: string;
  subtext?: string;
  icon: React.ReactNode;
  iconColor: string;
  onClick?: () => void;
  isLoading?: boolean;
};

function StatCard({ title, value, subtext, icon, iconColor, onClick, isLoading }: StatCardProps) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "group flex flex-col gap-3 rounded-xl border border-border bg-card p-5 text-left shadow-sm transition-all",
        onClick && "hover:shadow-md hover:border-primary/30 cursor-pointer"
      )}
    >
      <div className="flex items-center justify-between">
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", iconColor)}>
          {icon}
        </div>
        {onClick && (
          <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        )}
      </div>
      {isLoading ? (
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Loading…</span>
        </div>
      ) : (
        <div>
          <p className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">{value}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{title}</p>
          {subtext && <p className="mt-1 text-xs text-muted-foreground">{subtext}</p>}
        </div>
      )}
    </button>
  );
}

type RecentRowProps = {
  label: string;
  meta: string;
  amount: string;
  status: string;
};

function RecentRow({ label, meta, amount, status }: RecentRowProps) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{label}</p>
        <p className="text-xs text-muted-foreground">{meta}</p>
      </div>
      <div className="flex items-center gap-3 shrink-0 ml-4">
        <span className="text-sm font-medium tabular-nums text-foreground">{amount}</span>
        <StatusBadge status={status} />
      </div>
    </div>
  );
}

export default function CompanyDashboardPage() {
  const params = useParams<{ companySlug: string }>();
  const companySlug = params.companySlug;
  const { isLoading, error, user, companies, activeCompany, access, handleNavigate, handleLogout } =
    useCompanyContext(companySlug);

  const [data, setData] = useState<DashboardData | null>(null);
  const [dataLoading, setDataLoading] = useState(false);

  const loadDashboard = useCallback(async (companyId: string) => {
    setDataLoading(true);
    try {
      const today = new Date();
      const startOfYear = `${today.getFullYear()}-01-01`;
      const todayStr = today.toISOString().slice(0, 10);

      const [invoices, bills, arAging, apAging, pl] = await Promise.all([
        fetchInvoices(companyId).catch(() => [] as Invoice[]),
        fetchBills(companyId).catch(() => [] as Bill[]),
        fetchARAging(companyId).catch(() => [] as ARAgingRow[]),
        fetchAPAging(companyId).catch(() => [] as APAgingRow[]),
        fetchProfitLoss(companyId, { start_date: startOfYear, end_date: todayStr }).catch(() => null),
      ]);

      setData({
        invoices,
        bills,
        arAging,
        apAging,
        netProfit: pl?.net_profit ?? null,
      });
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!activeCompany) return;
    void loadDashboard(activeCompany.id);
  }, [activeCompany, loadDashboard]);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      </main>
    );
  }

  if (error || !user || !activeCompany || !access) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <section className="w-full max-w-md rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive">
          <p>{error || "Access context is missing."}</p>
          <button className="mt-3 text-sm underline" onClick={handleLogout}>
            Go to login
          </button>
        </section>
      </main>
    );
  }

  // Computed stats
  const openInvoices = data?.invoices.filter((inv) => ["posted", "partially_paid"].includes(inv.status)) ?? [];
  const openBills = data?.bills.filter((bill) => ["posted", "partially_paid"].includes(bill.status)) ?? [];
  const totalAR = data?.arAging.reduce((sum, row) => sum + parseFloat(row.open_amount || "0"), 0) ?? 0;
  const totalAP = data?.apAging.reduce((sum, row) => sum + parseFloat(row.open_amount || "0"), 0) ?? 0;
  const overdueAR = data?.arAging.filter((r) => ["61-90", "90+"].includes(r.bucket)) ?? [];
  const recentInvoices = [...(data?.invoices ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5);
  const recentBills = [...(data?.bills ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5);
  const currency = activeCompany.base_currency;
  const netProfitNum = data?.netProfit ? parseFloat(data.netProfit) : null;

  return (
    <AppShell
      user={user}
      companies={companies}
      activeCompany={activeCompany}
      access={access}
      onLogout={handleLogout}
      onNavigate={handleNavigate}
    >
      <PageHeader
        title={`Welcome back, ${user.full_name?.split(" ")[0] ?? "there"}`}
        description={`${activeCompany.name} · ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`}
      />

      {/* KPI stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Open Receivables (AR)"
          value={formatCurrency(totalAR, currency)}
          subtext={`${openInvoices.length} open invoice${openInvoices.length !== 1 ? "s" : ""}${overdueAR.length > 0 ? ` · ${overdueAR.length} overdue` : ""}`}
          icon={<TrendingUp className="h-4.5 w-4.5 text-blue-600" />}
          iconColor="bg-blue-50"
          isLoading={dataLoading}
          onClick={() => handleNavigate(getCompanyARAgingPath(activeCompany.slug))}
        />
        <StatCard
          title="Open Payables (AP)"
          value={formatCurrency(totalAP, currency)}
          subtext={`${openBills.length} open bill${openBills.length !== 1 ? "s" : ""}`}
          icon={<TrendingDown className="h-4.5 w-4.5 text-orange-600" />}
          iconColor="bg-orange-50"
          isLoading={dataLoading}
          onClick={() => handleNavigate(getCompanyAPAgingPath(activeCompany.slug))}
        />
        <StatCard
          title="Net Profit (YTD)"
          value={netProfitNum !== null ? formatCurrency(netProfitNum, currency) : "—"}
          subtext="Year to date"
          icon={<BarChart3 className={cn("h-4.5 w-4.5", netProfitNum !== null && netProfitNum >= 0 ? "text-emerald-600" : "text-red-500")} />}
          iconColor={netProfitNum !== null && netProfitNum >= 0 ? "bg-emerald-50" : "bg-red-50"}
          isLoading={dataLoading}
          onClick={() => handleNavigate(getCompanyProfitLossPath(activeCompany.slug))}
        />
        <StatCard
          title="Invoices This Month"
          value={String(
            (data?.invoices ?? []).filter((inv) => {
              const d = new Date(inv.issue_date);
              const now = new Date();
              return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            }).length
          )}
          subtext="Across all statuses"
          icon={<FileText className="h-4.5 w-4.5 text-violet-600" />}
          iconColor="bg-violet-50"
          isLoading={dataLoading}
          onClick={() => handleNavigate(getCompanyInvoicesPath(activeCompany.slug))}
        />
      </div>

      {/* Recent activity */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Invoices */}
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Recent Invoices</h2>
            </div>
            <button
              onClick={() => handleNavigate(getCompanyInvoicesPath(activeCompany.slug))}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              View all <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <div className="px-5 py-1">
            {dataLoading ? (
              <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : recentInvoices.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">No invoices yet.</p>
            ) : (
              recentInvoices.map((inv) => (
                <RecentRow
                  key={inv.id}
                  label={`Invoice #${inv.invoice_no ?? "—"}`}
                  meta={inv.issue_date}
                  amount={formatCurrency(inv.total, currency)}
                  status={inv.status}
                />
              ))
            )}
          </div>
        </div>

        {/* Recent Bills */}
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Recent Bills</h2>
            </div>
            <button
              onClick={() => handleNavigate(getCompanyBillsPath(activeCompany.slug))}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              View all <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <div className="px-5 py-1">
            {dataLoading ? (
              <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : recentBills.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">No bills yet.</p>
            ) : (
              recentBills.map((bill) => (
                <RecentRow
                  key={bill.id}
                  label={`Bill #${bill.bill_no ?? "—"}`}
                  meta={bill.bill_date}
                  amount={formatCurrency(bill.total, currency)}
                  status={bill.status}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="mt-6">
        <h2 className="text-sm font-semibold text-foreground mb-3">Quick actions</h2>
        <div className="flex flex-wrap gap-2">
          {[
            { label: "New Invoice", icon: <FileText className="h-3.5 w-3.5" />, path: getCompanyInvoicesPath(activeCompany.slug) },
            { label: "New Bill", icon: <ShoppingCart className="h-3.5 w-3.5" />, path: getCompanyBillsPath(activeCompany.slug) },
            { label: "AR Aging", icon: <TrendingUp className="h-3.5 w-3.5" />, path: getCompanyARAgingPath(activeCompany.slug) },
            { label: "AP Aging", icon: <TrendingDown className="h-3.5 w-3.5" />, path: getCompanyAPAgingPath(activeCompany.slug) },
            { label: "Profit & Loss", icon: <BarChart3 className="h-3.5 w-3.5" />, path: getCompanyProfitLossPath(activeCompany.slug) },
            { label: "Bank Reconciliation", icon: <Wallet className="h-3.5 w-3.5" />, path: `/app/c/${activeCompany.slug}/banking/reconciliation` },
          ].map((action) => (
            <button
              key={action.label}
              onClick={() => handleNavigate(action.path)}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:border-primary/30"
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
