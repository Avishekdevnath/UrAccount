"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ChevronRight, Loader2 } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { SystemShell } from "@/components/system-shell";
import { DangerConfirmModal } from "@/app/system/components/danger-confirm-modal";
import { PasswordResetModal } from "@/app/system/components/password-reset-modal";
import {
  formatApiError,
  systemDeactivateUser,
  systemFetchCompanies,
  systemFetchUser,
  systemResetUserPassword,
  systemUpdateUser,
  systemUpdateUserRole,
  systemUpsertCompanyMember,
  systemRemoveCompanyMember,
} from "@/lib/api-client";
import type { SystemCompany, SystemRole, SystemUserDetail } from "@/lib/api-types";
import { useSystemContext } from "@/lib/use-system-context";

const TENANT_ROLES = ["OWNER", "ADMIN", "ACCOUNTANT", "VIEWER"] as const;

type FormMessage = { type: "success" | "error"; text: string } | null;

type RoleSelection = Record<(typeof TENANT_ROLES)[number], boolean>;

const DEFAULT_ROLE_SELECTION: RoleSelection = {
  OWNER: false,
  ADMIN: false,
  ACCOUNTANT: false,
  VIEWER: true,
};

function toRoles(selection: RoleSelection) {
  return TENANT_ROLES.filter((role) => selection[role]);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function SystemUserDetailPage() {
  const params = useParams<{ userId: string }>();
  const userId = params.userId;
  const { isLoading, error, user, handleLogout, handleNavigate } = useSystemContext();

  const [record, setRecord] = useState<SystemUserDetail | null>(null);
  const [companies, setCompanies] = useState<SystemCompany[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<FormMessage>(null);

  const [fullName, setFullName] = useState("");
  const [isStaff, setIsStaff] = useState(false);
  const [isActive, setIsActive] = useState(true);

  const [systemRole, setSystemRole] = useState<SystemRole | "">("");
  const [systemRoleActive, setSystemRoleActive] = useState(true);

  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [deactivateModalOpen, setDeactivateModalOpen] = useState(false);
  const [removeMembershipTarget, setRemoveMembershipTarget] = useState<{
    companyId: string;
    companyName: string;
    membershipId: string;
  } | null>(null);

  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<RoleSelection>(DEFAULT_ROLE_SELECTION);

  const load = useCallback(async () => {
    setLoadingData(true);
    setMessage(null);
    try {
      const [userDetail, allCompanies] = await Promise.all([systemFetchUser(userId), systemFetchCompanies()]);
      setRecord(userDetail);
      setCompanies(allCompanies);
      setFullName(userDetail.full_name ?? "");
      setIsStaff(userDetail.is_staff);
      setIsActive(userDetail.is_active);
      setSystemRole((userDetail.system_role as SystemRole | null) ?? "");
      setSystemRoleActive(userDetail.system_role_active ?? true);
    } catch (loadError) {
      setMessage({ type: "error", text: formatApiError(loadError, "Failed to load user details.") });
    } finally {
      setLoadingData(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!user) return;
    void load();
  }, [user, load]);

  const availableCompanies = useMemo(() => {
    if (!record) return companies;
    const currentCompanyIds = new Set(record.memberships.map((membership) => membership.company_id));
    return companies.filter((company) => !currentCompanyIds.has(company.id));
  }, [companies, record]);

  async function runAction(actionKey: string, action: () => Promise<unknown>) {
    setPending(actionKey);
    setMessage(null);
    try {
      await action();
      setMessage({ type: "success", text: "Updated successfully." });
      await load();
    } catch (actionError) {
      setMessage({ type: "error", text: formatApiError(actionError, "Action failed.") });
    } finally {
      setPending(null);
    }
  }

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
        title={record?.email ?? "User Detail"}
        description={record ? `User ID: ${record.id}` : ""}
        breadcrumbs={[
          { label: "System", href: "/system" },
          { label: "Users", href: "/system/users" },
          { label: record?.email ?? userId },
        ]}
        actions={
          <button
            onClick={() => handleNavigate("/system/users")}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
          >
            Back to Users
          </button>
        }
      />

      {message ? (
        <div
          className={`mb-4 rounded-md border px-4 py-2 text-sm ${
            message.type === "error"
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
          data-testid="system-user-message"
        >
          {message.text}
        </div>
      ) : null}

      {loadingData || !record ? (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading user detail...
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Section title="Profile & Access">
            <div className="space-y-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted-foreground">Full name</span>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="rounded-md border border-input bg-background px-3 py-2"
                />
              </label>

              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isStaff}
                  onChange={(e) => setIsStaff(e.target.checked)}
                  className="h-4 w-4 rounded border-input accent-primary"
                />
                <span>Staff user</span>
              </label>

              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-input accent-primary"
                />
                <span>Active account</span>
              </label>

              <button
                onClick={() => runAction("profile", () => systemUpdateUser(userId, { full_name: fullName, is_staff: isStaff, is_active: isActive }))}
                disabled={pending === "profile"}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {pending === "profile" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save profile
              </button>
            </div>
          </Section>

          <Section title="System Role">
            <div className="space-y-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted-foreground">Role</span>
                <select
                  value={systemRole}
                  onChange={(e) => setSystemRole(e.target.value as SystemRole | "")}
                  className="rounded-md border border-input bg-background px-3 py-2"
                  data-testid="system-role-select"
                >
                  <option value="">No system role</option>
                  <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                  <option value="SUPPORT">SUPPORT</option>
                </select>
              </label>

              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={systemRoleActive}
                  onChange={(e) => setSystemRoleActive(e.target.checked)}
                  disabled={!systemRole}
                  className="h-4 w-4 rounded border-input accent-primary"
                  data-testid="system-role-active-checkbox"
                />
                <span>Role active</span>
              </label>

              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    runAction("system-role", () =>
                      systemUpdateUserRole(userId, systemRole ? { role: systemRole, is_active: systemRoleActive } : { role: null })
                    )
                  }
                  disabled={pending === "system-role"}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                  data-testid="system-role-save-button"
                >
                  {pending === "system-role" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Save role
                </button>
              </div>
            </div>
          </Section>

          <Section title="Security Actions">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setPasswordModalOpen(true)}
                  disabled={pending === "password"}
                  className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-accent disabled:opacity-60"
                >
                  {pending === "password" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Open password reset
                </button>

                <button
                  onClick={() => setDeactivateModalOpen(true)}
                  disabled={pending === "deactivate"}
                  className="inline-flex items-center gap-2 rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                >
                  {pending === "deactivate" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Deactivate user
                </button>
              </div>
            </div>
          </Section>

          <Section title="Company Memberships">
            <div className="space-y-4">
              {record.memberships.length === 0 ? (
                <p className="text-sm text-muted-foreground">No memberships yet.</p>
              ) : (
                <div className="divide-y divide-border rounded-md border border-border">
                  {record.memberships.map((membership) => (
                    <div key={membership.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-foreground">{membership.company_name}</p>
                        <p className="truncate text-xs text-muted-foreground">{membership.company_slug} • {membership.status}</p>
                      </div>
                      <button
                        onClick={() => handleNavigate(`/system/companies/${membership.company_id}`)}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
                      >
                        Details
                        <ChevronRight className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() =>
                          setRemoveMembershipTarget({
                            companyId: membership.company_id,
                            companyName: membership.company_name,
                            membershipId: membership.id,
                          })
                        }
                        disabled={pending === `remove-${membership.id}`}
                        className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-60"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="rounded-md border border-border p-3">
                <p className="text-sm font-medium text-foreground">Add membership</p>
                <div className="mt-2 grid grid-cols-1 gap-3">
                  <select
                    value={selectedCompanyId}
                    onChange={(e) => setSelectedCompanyId(e.target.value)}
                    className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select company</option>
                    {availableCompanies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name} ({company.slug})
                      </option>
                    ))}
                  </select>

                  <div className="flex flex-wrap gap-3">
                    {TENANT_ROLES.map((role) => (
                      <label key={role} className="inline-flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={selectedRoles[role]}
                          onChange={(e) =>
                            setSelectedRoles((prev) => ({ ...prev, [role]: e.target.checked }))
                          }
                          className="h-4 w-4 rounded border-input accent-primary"
                        />
                        {role}
                      </label>
                    ))}
                  </div>

                  <button
                    onClick={() =>
                      runAction("membership", async () => {
                        const roles = toRoles(selectedRoles);
                        if (!selectedCompanyId) {
                          throw new Error("Select a company first.");
                        }
                        if (roles.length === 0) {
                          throw new Error("Select at least one role.");
                        }
                        await systemUpsertCompanyMember(selectedCompanyId, {
                          user_id: userId,
                          status: "active",
                          roles,
                        });
                        setSelectedCompanyId("");
                        setSelectedRoles(DEFAULT_ROLE_SELECTION);
                      })
                    }
                    disabled={pending === "membership" || !selectedCompanyId}
                    className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-accent disabled:opacity-60"
                  >
                    {pending === "membership" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Add membership
                  </button>
                </div>
              </div>
            </div>
          </Section>
        </div>
      )}

      <PasswordResetModal
        open={passwordModalOpen}
        onClose={() => setPasswordModalOpen(false)}
        userEmail={record?.email ?? ""}
        isPending={pending === "password"}
        onSubmit={async (password) => {
          await runAction("password", async () => {
            await systemResetUserPassword(userId, password);
            setPasswordModalOpen(false);
          });
        }}
      />

      <DangerConfirmModal
        open={deactivateModalOpen}
        onClose={() => setDeactivateModalOpen(false)}
        title="Deactivate user"
        description={`Deactivate ${record?.email ?? "this user"}? They will lose access immediately.`}
        confirmLabel="Deactivate"
        isPending={pending === "deactivate"}
        onConfirm={() => {
          void runAction("deactivate", async () => {
            await systemDeactivateUser(userId);
            setDeactivateModalOpen(false);
          });
        }}
      />

      <DangerConfirmModal
        open={Boolean(removeMembershipTarget)}
        onClose={() => setRemoveMembershipTarget(null)}
        title="Remove company membership"
        description={
          removeMembershipTarget
            ? `Remove ${record?.email ?? "user"} from ${removeMembershipTarget.companyName}?`
            : ""
        }
        confirmLabel="Remove"
        isPending={
          Boolean(removeMembershipTarget) &&
          pending === `remove-${removeMembershipTarget?.membershipId}`
        }
        onConfirm={() => {
          if (!removeMembershipTarget) return;
          void runAction(`remove-${removeMembershipTarget.membershipId}`, async () => {
            await systemRemoveCompanyMember(removeMembershipTarget.companyId, userId);
            setRemoveMembershipTarget(null);
          });
        }}
      />
    </SystemShell>
  );
}

