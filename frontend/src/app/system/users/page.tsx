"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";

import { SystemShell } from "@/components/system-shell";
import { PageHeader } from "@/components/page-header";
import { formatApiError, systemFetchUsers, systemUpdateUserRole } from "@/lib/api-client";
import { useSystemContext } from "@/lib/use-system-context";
import type { SystemUser } from "@/lib/api-types";

export default function SystemUsersPage() {
  const { isLoading, error, user, handleLogout, handleNavigate } = useSystemContext();

  const [users, setUsers] = useState<SystemUser[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setDataLoading(true);
    try {
      const data = await systemFetchUsers();
      setUsers(data);
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    void load();
  }, [user, load]);

  async function handleGrantRole(targetUser: SystemUser, role: "SUPER_ADMIN" | "SUPPORT") {
    setActionPending(targetUser.id);
    setActionError(null);
    try {
      const res = await systemUpdateUserRole(targetUser.id, { role, is_active: true });
      setUsers((prev) =>
        prev.map((u) =>
          u.id === targetUser.id
            ? {
                ...u,
                system_role: res.system_role?.role ?? null,
                system_role_active: res.system_role?.is_active ?? null,
              }
            : u
        )
      );
      setActionSuccess(`Role granted to ${targetUser.email}.`);
    } catch (error) {
      setActionError(formatApiError(error, `Failed to update role for ${targetUser.email}.`));
    } finally {
      setActionPending(null);
    }
  }

  async function handleRevokeRole(targetUser: SystemUser) {
    setActionPending(targetUser.id);
    setActionError(null);
    try {
      await systemUpdateUserRole(targetUser.id, { role: null });
      setUsers((prev) =>
        prev.map((u) =>
          u.id === targetUser.id
            ? { ...u, system_role: null, system_role_active: null }
            : u
        )
      );
      setActionSuccess(`Role revoked from ${targetUser.email}.`);
    } catch (error) {
      setActionError(formatApiError(error, `Failed to revoke role for ${targetUser.email}.`));
    } finally {
      setActionPending(null);
    }
  }

  const filtered = users.filter(
    (u) =>
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.full_name ?? "").toLowerCase().includes(search.toLowerCase())
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
      <PageHeader title="Users" description={`${users.length} total users`} />

      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by email or name…"
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
      {actionSuccess && (
        <div className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
          {actionSuccess}
        </div>
      )}

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                User
              </th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Companies
              </th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                System Role
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
                  Loading users…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  {search ? "No users match your search." : "No users."}
                </td>
              </tr>
            ) : (
              filtered.map((u) => (
                <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{u.email}</p>
                    {u.full_name && (
                      <p className="text-xs text-muted-foreground">{u.full_name}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-muted-foreground">{u.company_count}</td>
                  <td className="px-4 py-3 text-center">
                    {u.system_role ? (
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          u.system_role === "SUPER_ADMIN"
                            ? "bg-red-50 text-red-700"
                            : "bg-blue-50 text-blue-700"
                        }`}
                      >
                        {u.system_role}
                        {u.system_role_active === false && (
                          <span className="ml-1 text-muted-foreground">(inactive)</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                        u.is_active
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-red-50 text-red-600"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          u.is_active ? "bg-emerald-500" : "bg-red-500"
                        }`}
                      />
                      {u.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleNavigate(`/system/users/${u.id}`)}
                        className="rounded-md px-2.5 py-1 text-xs font-medium border border-border text-muted-foreground hover:bg-accent transition-colors"
                      >
                        Details
                      </button>
                      {actionPending === u.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                      ) : u.system_role ? (
                        <button
                          onClick={() => handleRevokeRole(u)}
                          className="rounded-md px-2.5 py-1 text-xs font-medium border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                        >
                          Revoke
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => handleGrantRole(u, "SUPER_ADMIN")}
                            className="rounded-md px-2.5 py-1 text-xs font-medium border border-red-200 text-red-700 hover:bg-red-50 transition-colors"
                          >
                            Grant Admin
                          </button>
                          <button
                            onClick={() => handleGrantRole(u, "SUPPORT")}
                            className="rounded-md px-2.5 py-1 text-xs font-medium border border-blue-200 text-blue-700 hover:bg-blue-50 transition-colors"
                          >
                            Grant Support
                          </button>
                        </>
                      )}
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
