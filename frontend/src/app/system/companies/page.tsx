"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronRight, Loader2, Search } from "lucide-react";

import { SystemShell } from "@/components/system-shell";
import { PageHeader } from "@/components/page-header";
import { formatApiError, systemFetchCompanies, systemUpdateCompanyStatus } from "@/lib/api-client";
import { useSystemContext } from "@/lib/use-system-context";
import type { SystemCompany } from "@/lib/api-types";

export default function SystemCompaniesPage() {
  const { isLoading, error, user, handleLogout, handleNavigate } = useSystemContext();

  const [companies, setCompanies] = useState<SystemCompany[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setDataLoading(true);
    try {
      const data = await systemFetchCompanies();
      setCompanies(data);
    } catch (error) {
      setActionError(formatApiError(error, "Failed to load companies."));
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    void load();
  }, [user, load]);

  async function toggleStatus(company: SystemCompany) {
    setActionPending(company.id);
    setActionError(null);
    const nextIsActive = !company.is_active;
    const previousCompanies = companies;
    setCompanies((prev) =>
      prev.map((c) => (c.id === company.id ? { ...c, is_active: nextIsActive } : c))
    );
    try {
      const res = await systemUpdateCompanyStatus(company.id, nextIsActive);
      setCompanies((prev) =>
        prev.map((c) => (c.id === company.id ? { ...c, is_active: res.is_active } : c))
      );
    } catch (error) {
      setCompanies(previousCompanies);
      setActionError(formatApiError(error, `Failed to update ${company.name}.`));
    } finally {
      setActionPending(null);
    }
  }

  const filtered = companies.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.slug.toLowerCase().includes(search.toLowerCase())
  );

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
        title="Companies"
        description={`${companies.length} total companies`}
        actions={
          <button
            onClick={() => handleNavigate("/system/companies/new")}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            New Company
          </button>
        }
      />

      {/* Filter bar */}
      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name or slug…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-input bg-background pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      {actionError && (
        <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {actionError}
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Company
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Currency
              </th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Members
              </th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Status
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {dataLoading ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                  Loading companies…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  {search ? "No companies match your search." : "No companies yet."}
                </td>
              </tr>
            ) : (
              filtered.map((company) => (
                <tr key={company.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{company.name}</p>
                    <p className="text-xs text-muted-foreground">{company.slug}</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{company.base_currency}</td>
                  <td className="px-4 py-3 text-center text-muted-foreground">{company.members_count}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                        company.is_active
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-red-50 text-red-600"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          company.is_active ? "bg-emerald-500" : "bg-red-500"
                        }`}
                      />
                      {company.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => toggleStatus(company)}
                        disabled={actionPending === company.id}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors border ${
                          company.is_active
                            ? "border-red-200 text-red-600 hover:bg-red-50"
                            : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                        } disabled:opacity-50`}
                      >
                        {actionPending === company.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : company.is_active ? (
                          "Deactivate"
                        ) : (
                          "Activate"
                        )}
                      </button>
                      <button
                        onClick={() => handleNavigate(`/system/companies/${company.id}`)}
                        className="flex items-center gap-0.5 rounded-md px-2.5 py-1 text-xs font-medium border border-border text-muted-foreground hover:bg-accent transition-colors"
                      >
                        Details
                        <ChevronRight className="h-3 w-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </SystemShell>
  );
}
