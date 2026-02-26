"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Search, X } from "lucide-react";

import { SystemShell } from "@/components/system-shell";
import { PageHeader } from "@/components/page-header";
import { systemFetchAuditLogs } from "@/lib/api-client";
import { useSystemContext } from "@/lib/use-system-context";
import type { SystemAuditLog } from "@/lib/api-types";

export default function SystemAuditLogsPage() {
  const { isLoading, error, user, handleLogout } = useSystemContext();

  const [logs, setLogs] = useState<SystemAuditLog[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState<SystemAuditLog | null>(null);

  const [filterAction, setFilterAction] = useState("");
  const [filterResourceType, setFilterResourceType] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const [appliedAction, setAppliedAction] = useState("");
  const [appliedResourceType, setAppliedResourceType] = useState("");
  const [appliedDateFrom, setAppliedDateFrom] = useState("");
  const [appliedDateTo, setAppliedDateTo] = useState("");

  const load = useCallback(async () => {
    setDataLoading(true);
    try {
      const data = await systemFetchAuditLogs({
        action: appliedAction || undefined,
        resource_type: appliedResourceType || undefined,
        date_from: appliedDateFrom || undefined,
        date_to: appliedDateTo || undefined,
      });
      setLogs(data);
    } finally {
      setDataLoading(false);
    }
  }, [appliedAction, appliedResourceType, appliedDateFrom, appliedDateTo]);

  useEffect(() => {
    if (!user) return;
    void load();
  }, [user, load]);

  function applyFilters() {
    setAppliedAction(filterAction.trim());
    setAppliedResourceType(filterResourceType.trim());
    setAppliedDateFrom(filterDateFrom);
    setAppliedDateTo(filterDateTo);
  }

  function clearFilters() {
    setFilterAction("");
    setFilterResourceType("");
    setFilterDateFrom("");
    setFilterDateTo("");
    setAppliedAction("");
    setAppliedResourceType("");
    setAppliedDateFrom("");
    setAppliedDateTo("");
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite">
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
          <button className="mt-3 cursor-pointer text-sm underline" onClick={handleLogout}>
            Go to login
          </button>
        </section>
      </main>
    );
  }

  return (
    <SystemShell user={user} onLogout={handleLogout}>
      <PageHeader title="Audit Logs" description="Read-only record of all system mutations." />

      <div className="mb-4 flex flex-wrap items-end gap-3" aria-label="Audit filters">
        <div className="relative">
          <label htmlFor="audit-action-filter" className="mb-1 block text-xs text-muted-foreground">
            Action
          </label>
          <Search className="absolute left-2.5 top-[33px] h-3.5 w-3.5 text-muted-foreground" />
          <input
            id="audit-action-filter"
            type="text"
            placeholder="Filter by action"
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="w-52 rounded-md border border-input bg-background py-1.5 pl-8 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div>
          <label htmlFor="audit-resource-filter" className="mb-1 block text-xs text-muted-foreground">
            Resource type
          </label>
          <input
            id="audit-resource-filter"
            type="text"
            placeholder="Resource type"
            value={filterResourceType}
            onChange={(e) => setFilterResourceType(e.target.value)}
            className="w-40 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div>
          <label htmlFor="audit-date-from" className="mb-1 block text-xs text-muted-foreground">
            Date from
          </label>
          <input
            id="audit-date-from"
            type="date"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div>
          <label htmlFor="audit-date-to" className="mb-1 block text-xs text-muted-foreground">
            Date to
          </label>
          <input
            id="audit-date-to"
            type="date"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <button
          type="button"
          onClick={applyFilters}
          className="cursor-pointer rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          Apply
        </button>
        <button
          type="button"
          onClick={clearFilters}
          className="cursor-pointer rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
        >
          Clear
        </button>
        <span className="ml-auto text-xs text-muted-foreground" aria-live="polite">
          {dataLoading ? "Loading results..." : `${logs.length} results`}
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">When</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actor</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Action</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Resource</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">IP</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Inspect</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {dataLoading ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  Loading logs...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-sm text-muted-foreground">No audit log entries found.</td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="transition-colors hover:bg-muted/30">
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 text-xs text-foreground">{log.actor_email || "system"}</td>
                  <td className="px-4 py-3">
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">{log.action}</code>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{log.resource_type}</span>
                    <span className="mx-1">-</span>
                    <span className="inline-block max-w-[120px] truncate align-bottom font-mono">{log.resource_id}</span>
                    {log.request_id ? (
                      <span className="ml-2 inline-block rounded bg-muted px-1 py-0.5 font-mono text-[10px] text-muted-foreground">
                        req:{log.request_id}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{log.ip_address || "-"}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedLog(log)}
                      className="cursor-pointer rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
                      aria-label={`Inspect audit event ${log.action}`}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedLog ? (
        <section className="mt-4 rounded-xl border border-border bg-card p-4 shadow-sm" aria-label="Audit event details">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Audit Event Detail</h2>
            <button
              type="button"
              onClick={() => setSelectedLog(null)}
              className="cursor-pointer rounded-md border border-border p-1 hover:bg-accent"
              aria-label="Close details"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <pre className="overflow-auto rounded-md bg-muted p-3 text-xs md:col-span-2"><strong>request_id</strong>{"\n"}{selectedLog.request_id || "-"}</pre>
            <pre className="overflow-auto rounded-md bg-muted p-3 text-xs"><strong>before</strong>{"\n"}{JSON.stringify(selectedLog.before, null, 2)}</pre>
            <pre className="overflow-auto rounded-md bg-muted p-3 text-xs"><strong>after</strong>{"\n"}{JSON.stringify(selectedLog.after, null, 2)}</pre>
            <pre className="overflow-auto rounded-md bg-muted p-3 text-xs md:col-span-2"><strong>metadata</strong>{"\n"}{JSON.stringify(selectedLog.metadata, null, 2)}</pre>
          </div>
        </section>
      ) : null}
    </SystemShell>
  );
}
