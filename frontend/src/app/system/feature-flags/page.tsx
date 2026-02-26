"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { SystemShell } from "@/components/system-shell";
import { PageHeader } from "@/components/page-header";
import { formatApiError, systemFetchGlobalFeatureFlags } from "@/lib/api-client";
import { useSystemContext } from "@/lib/use-system-context";
import type { SystemGlobalFeatureFlags } from "@/lib/api-types";

function FlagRow({ label, value, description }: { label: string; value: boolean; description?: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
          value ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground"
        }`}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${value ? "bg-emerald-500" : "bg-border"}`}
        />
        {value ? "Enabled" : "Disabled"}
      </span>
    </div>
  );
}

export default function SystemFeatureFlagsPage() {
  const { isLoading, error, user, handleLogout } = useSystemContext();

  const [flags, setFlags] = useState<SystemGlobalFeatureFlags | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    setDataLoading(true);
    setLoadError("");
    try {
      const data = await systemFetchGlobalFeatureFlags();
      setFlags(data);
    } catch (error) {
      setLoadError(formatApiError(error, "Failed to load global feature flags."));
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    void load();
  }, [user, load]);

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
        title="Global Feature Flags"
        description="Server-side feature gates read from environment variables. Change these in your deployment environment and restart the server."
      />

      <div className="max-w-lg">
        <div className="rounded-xl border border-border bg-card shadow-sm p-5">
          {loadError && (
            <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {loadError}
            </div>
          )}
          {dataLoading || !flags ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading flags…
            </div>
          ) : (
            <>
              <FlagRow
                label="System Admin Enabled"
                value={flags.system_admin_enabled}
                description="SYSTEM_ADMIN_ENABLED — controls access to this panel."
              />
              <FlagRow
                label="AI Enabled"
                value={flags.ai_enabled}
                description="AI_ENABLED — global AI feature gate."
              />
              <FlagRow
                label="Subscription Enabled"
                value={flags.subscription_enabled}
                description="SUBSCRIPTION_ENABLED — billing and subscription features."
              />
              <FlagRow
                label="Browsable API Enabled"
                value={flags.browsable_api_enabled}
                description="ENABLE_BROWSABLE_API — Django REST Framework browsable API."
              />
            </>
          )}
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          These flags are read-only in the UI. To change them, update your server environment variables
          and redeploy or restart the backend process.
        </p>
      </div>
    </SystemShell>
  );
}
