"use client";

import { Loader2 } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { SystemShell } from "@/components/system-shell";
import { CompanyBootstrapWizard } from "@/modules/system/components/company-bootstrap-wizard";
import { useSystemContext } from "@/lib/use-system-context";

export default function SystemCompanyNewPage() {
  const { isLoading, error, user, handleLogout, handleNavigate } = useSystemContext();

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading...
        </div>
      </main>
    );
  }

  if (error || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <section className="w-full max-w-md rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive">
          <p>{error || "Access denied."}</p>
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
        title="Create Company"
        description="Bootstrap a new tenant with its first owner account."
        breadcrumbs={[
          { label: "System", href: "/system" },
          { label: "Companies", href: "/system/companies" },
          { label: "Create" },
        ]}
      />

      <CompanyBootstrapWizard onSuccess={() => handleNavigate("/system/companies")} />
    </SystemShell>
  );
}
