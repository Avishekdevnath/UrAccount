"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, Save } from "lucide-react";

import { SystemShell } from "@/components/system-shell";
import { PageHeader } from "@/components/page-header";
import {
  formatApiError,
  systemFetchCompany,
  systemUpdateCompanyFeatureFlags,
  systemUpdateCompanyQuotas,
  systemUpdateCompanyStatus,
} from "@/lib/api-client";
import { useSystemContext } from "@/lib/use-system-context";
import type { SystemCompanyDetail } from "@/lib/api-types";

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm p-5">
      <h2 className="text-sm font-semibold text-foreground mb-4">{title}</h2>
      {children}
    </div>
  );
}

export default function SystemCompanyDetailPage() {
  const params = useParams<{ companyId: string }>();
  const companyId = params.companyId;
  const { isLoading, error, user, handleLogout } = useSystemContext();

  const [company, setCompany] = useState<SystemCompanyDetail | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // Local editable state for feature flags and quotas
  const [flags, setFlags] = useState<SystemCompanyDetail["feature_flags"] | null>(null);
  const [quotas, setQuotas] = useState<SystemCompanyDetail["quotas"] | null>(null);

  const load = useCallback(async () => {
    setDataLoading(true);
    try {
      const data = await systemFetchCompany(companyId);
      setCompany(data);
      setFlags(data.feature_flags);
      setQuotas(data.quotas);
    } catch (error) {
      setSaveError(formatApiError(error, "Failed to load company details."));
    } finally {
      setDataLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (!user) return;
    void load();
  }, [user, load]);

  async function handleToggleStatus() {
    if (!company) return;
    setSaving("status");
    setSaveError(null);
    const nextIsActive = !company.is_active;
    const previousIsActive = company.is_active;
    setCompany((prev) => (prev ? { ...prev, is_active: nextIsActive } : prev));
    try {
      const res = await systemUpdateCompanyStatus(company.id, nextIsActive);
      setCompany((prev) => prev ? { ...prev, is_active: res.is_active } : prev);
      setSaveSuccess("Status updated.");
    } catch (error) {
      setCompany((prev) => (prev ? { ...prev, is_active: previousIsActive } : prev));
      setSaveError(formatApiError(error, "Failed to update status."));
    } finally {
      setSaving(null);
    }
  }

  async function handleSaveFlags() {
    if (!company || !flags) return;
    setSaving("flags");
    setSaveError(null);
    try {
      const res = await systemUpdateCompanyFeatureFlags(company.id, flags);
      setFlags(res.feature_flags);
      setSaveSuccess("Feature flags saved.");
    } catch (error) {
      setSaveError(formatApiError(error, "Failed to save feature flags."));
    } finally {
      setSaving(null);
    }
  }

  async function handleSaveQuotas() {
    if (!company || !quotas) return;
    setSaving("quotas");
    setSaveError(null);
    try {
      const res = await systemUpdateCompanyQuotas(company.id, quotas);
      setQuotas(res.quotas);
      setSaveSuccess("Quotas saved.");
    } catch (error) {
      setSaveError(formatApiError(error, "Failed to save quotas."));
    } finally {
      setSaving(null);
    }
  }

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
        title={company?.name ?? "Company Details"}
        description={company?.slug}
        breadcrumbs={[
          { label: "System", href: "/system" },
          { label: "Companies", href: "/system/companies" },
          { label: company?.name ?? companyId },
        ]}
      />

      {saveError && (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {saveError}
        </div>
      )}
      {saveSuccess && (
        <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
          {saveSuccess}
        </div>
      )}

      {dataLoading || !company ? (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading company details…
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Info */}
          <SectionCard title="Company Info">
            <dl className="space-y-2 text-sm">
              {[
                ["ID", company.id],
                ["Name", company.name],
                ["Slug", company.slug],
                ["Currency", company.base_currency],
                ["Timezone", company.timezone],
                ["Fiscal Year Start", `Month ${company.fiscal_year_start_month}`],
                ["Members", String(company.members_count)],
                ["Created", new Date(company.created_at).toLocaleDateString()],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt className="text-muted-foreground shrink-0">{label}</dt>
                  <dd className="font-medium text-foreground text-right truncate">{value}</dd>
                </div>
              ))}
            </dl>

            {/* Status toggle */}
            <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
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
              </div>
              <button
                onClick={handleToggleStatus}
                disabled={saving === "status"}
                className={`rounded-md px-3 py-1.5 text-xs font-medium border transition-colors disabled:opacity-50 ${
                  company.is_active
                    ? "border-red-200 text-red-600 hover:bg-red-50"
                    : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                }`}
              >
                {saving === "status" ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : company.is_active ? (
                  "Deactivate Company"
                ) : (
                  "Activate Company"
                )}
              </button>
            </div>
          </SectionCard>

          {/* Feature Flags */}
          {flags && (
            <SectionCard title="Feature Flags">
              <div className="space-y-3">
                {(
                  [
                    ["ai_enabled", "AI Enabled"],
                    ["ai_suggestions_enabled", "AI Suggestions"],
                    ["ai_rag_enabled", "AI RAG"],
                  ] as [keyof typeof flags, string][]
                ).map(([key, label]) => (
                  <label key={key} className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm text-foreground">{label}</span>
                    <input
                      type="checkbox"
                      checked={Boolean(flags[key])}
                      onChange={(e) =>
                        setFlags((prev) => prev ? { ...prev, [key]: e.target.checked } : prev)
                      }
                      className="h-4 w-4 rounded border-input accent-primary"
                    />
                  </label>
                ))}
              </div>
              <button
                onClick={handleSaveFlags}
                disabled={saving === "flags"}
                className="mt-4 flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {saving === "flags" ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Save className="h-3 w-3" />
                )}
                Save flags
              </button>
            </SectionCard>
          )}

          {/* Quotas */}
          {quotas && (
            <SectionCard title="Quotas">
              <div className="space-y-3">
                {(
                  [
                    ["max_users", "Max Users"],
                    ["max_storage_mb", "Max Storage (MB)"],
                    ["max_api_requests_per_minute", "Max API Req/min"],
                  ] as [keyof typeof quotas, string][]
                ).map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between gap-4">
                    <label className="text-sm text-foreground shrink-0">{label}</label>
                    <input
                      type="number"
                      min={1}
                      value={quotas[key] ?? ""}
                      placeholder="unlimited"
                      onChange={(e) =>
                        setQuotas((prev) =>
                          prev
                            ? {
                                ...prev,
                                [key]: e.target.value === "" ? null : parseInt(e.target.value, 10),
                              }
                            : prev
                        )
                      }
                      className="w-32 rounded-md border border-input bg-background px-2.5 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                ))}
              </div>
              <button
                onClick={handleSaveQuotas}
                disabled={saving === "quotas"}
                className="mt-4 flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {saving === "quotas" ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Save className="h-3 w-3" />
                )}
                Save quotas
              </button>
            </SectionCard>
          )}
        </div>
      )}
    </SystemShell>
  );
}
