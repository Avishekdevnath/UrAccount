"use client";

import { useParams } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { getCompanyDashboardPath } from "@/lib/company-routing";
import { useCompanyContext } from "@/lib/use-company-context";

export default function CompanyDashboardPage() {
  const params = useParams<{ companySlug: string }>();
  const companySlug = params.companySlug;
  const { isLoading, error, user, companies, activeCompany, access, handleNavigate, handleLogout } =
    useCompanyContext(companySlug);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-zinc-600">Loading dashboard...</p>
      </main>
    );
  }

  if (error || !user || !activeCompany || !access) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <section className="w-full max-w-md rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          <p>{error || "Access context is missing."}</p>
          <button className="mt-3 text-sm underline" onClick={handleLogout}>
            Go to login
          </button>
        </section>
      </main>
    );
  }

  return (
    <AppShell
      user={user}
      companies={companies}
      activeCompany={activeCompany}
      access={access}
      onLogout={handleLogout}
      onNavigate={handleNavigate}
    >
      <div className="rounded-lg border border-zinc-200 p-4">
        <h2 className="text-lg font-medium text-zinc-900">Dashboard</h2>
        <p className="mt-2 text-sm text-zinc-600">Tenant route: {getCompanyDashboardPath(activeCompany.slug)}</p>
        <p className="mt-1 text-sm text-zinc-600">
          Accounting basics are now available from the navigation above.
        </p>
      </div>
    </AppShell>
  );
}
