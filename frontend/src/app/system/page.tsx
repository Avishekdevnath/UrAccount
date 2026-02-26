"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, Building2, Loader2, Users } from "lucide-react";

import { SystemShell } from "@/components/system-shell";
import { PageHeader } from "@/components/page-header";
import { systemFetchCompanies, systemFetchUsers, systemHealthCheck } from "@/lib/api-client";
import { useSystemContext } from "@/lib/use-system-context";

type DashboardStats = {
  totalCompanies: number;
  activeCompanies: number;
  totalUsers: number;
  systemAdmins: number;
  apiStatus: "ok" | "error" | "loading";
};

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  iconColor,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  iconColor: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconColor}`}>
          <Icon className="h-4.5 w-4.5" />
        </div>
      </div>
      <p className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">{value}</p>
      <p className="mt-0.5 text-sm text-muted-foreground">{label}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export default function SystemDashboardPage() {
  const { isLoading, error, user, handleLogout, handleNavigate } = useSystemContext();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const [companies, users, health] = await Promise.all([
        systemFetchCompanies().catch(() => []),
        systemFetchUsers().catch(() => []),
        systemHealthCheck().catch(() => null),
      ]);

      setStats({
        totalCompanies: companies.length,
        activeCompanies: companies.filter((c) => c.is_active).length,
        totalUsers: users.length,
        systemAdmins: users.filter((u) => u.system_role != null).length,
        apiStatus: health?.status === "ok" ? "ok" : "error",
      });
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    void loadStats();
  }, [user, loadStats]);

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

  if (error || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <section
          className="w-full max-w-md rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive"
          data-testid="system-access-denied"
        >
          <p>{error || "Access denied. System admin required."}</p>
          <button className="mt-3 text-sm underline" onClick={handleLogout}>
            Go to login
          </button>
        </section>
      </main>
    );
  }

  return (
    <SystemShell user={user} onLogout={handleLogout}>
      <PageHeader
        title="System Dashboard"
        description="Control plane overview for UrAccount operations."
      />

      {/* API Health */}
      <div className="mb-4 flex items-center gap-2">
        <span className="text-xs text-muted-foreground">API status:</span>
        {statsLoading || !stats ? (
          <span className="text-xs text-muted-foreground">checking…</span>
        ) : (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
              stats.apiStatus === "ok"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                stats.apiStatus === "ok" ? "bg-emerald-500" : "bg-red-500"
              }`}
            />
            {stats.apiStatus === "ok" ? "healthy" : "unreachable"}
          </span>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Companies"
          value={statsLoading ? "—" : (stats?.totalCompanies ?? "—")}
          sub={stats ? `${stats.activeCompanies} active` : undefined}
          icon={Building2}
          iconColor="bg-blue-50 text-blue-600"
        />
        <StatCard
          label="Active Companies"
          value={statsLoading ? "—" : (stats?.activeCompanies ?? "—")}
          icon={Building2}
          iconColor="bg-emerald-50 text-emerald-600"
        />
        <StatCard
          label="Total Users"
          value={statsLoading ? "—" : (stats?.totalUsers ?? "—")}
          icon={Users}
          iconColor="bg-violet-50 text-violet-600"
        />
        <StatCard
          label="System Admins"
          value={statsLoading ? "—" : (stats?.systemAdmins ?? "—")}
          sub="SUPER_ADMIN or SUPPORT"
          icon={Activity}
          iconColor="bg-orange-50 text-orange-600"
        />
      </div>

      {/* Quick links */}
      <div className="mt-8">
        <h2 className="text-sm font-semibold text-foreground mb-3">Quick actions</h2>
        <div className="flex flex-wrap gap-2">
          {[
            { label: "View Companies", path: "/system/companies" },
            { label: "Create Company", path: "/system/companies/new" },
            { label: "Manage Users", path: "/system/users" },
            { label: "Audit Logs", path: "/system/audit-logs" },
            { label: "Feature Flags", path: "/system/feature-flags" },
          ].map((action) => (
            <button
              key={action.path}
              onClick={() => handleNavigate(action.path)}
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:border-primary/30"
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </SystemShell>
  );
}
