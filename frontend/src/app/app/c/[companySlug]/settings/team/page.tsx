"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import {
  createCompanyMemberUser,
  fetchCompanyMembers,
  formatApiError,
  removeCompanyMember,
  replaceCompanyMemberRoles,
  resetCompanyMemberPassword,
  updateCompanyMemberStatus,
} from "@/lib/api-client";
import type { CompanyMember } from "@/lib/api-types";
import { getCompanyTeamSettingsPath } from "@/lib/company-routing";
import { useCompanyContext } from "@/lib/use-company-context";
import { TeamMemberCreateForm } from "@/modules/company-team/components/team-member-create-form";
import { AssignableTeamRole, TeamMemberRoleModal } from "@/modules/company-team/components/team-member-role-modal";
import { TeamMembersTable } from "@/modules/company-team/components/team-members-table";

type TeamMemberCreatePayload = {
  email: string;
  full_name: string;
  password: string;
  role: "Admin" | "Accountant" | "Viewer";
};

export default function TeamSettingsPage() {
  const params = useParams<{ companySlug: string }>();
  const companySlug = params.companySlug;
  const { isLoading, error, user, companies, activeCompany, access, handleNavigate, handleLogout } =
    useCompanyContext(companySlug);

  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [createPending, setCreatePending] = useState(false);
  const [actionPendingUserId, setActionPendingUserId] = useState<string | null>(null);
  const [roleModalMember, setRoleModalMember] = useState<CompanyMember | null>(null);
  const [errorBanner, setErrorBanner] = useState("");
  const [successBanner, setSuccessBanner] = useState("");

  const canManageMembers = !!access?.permissions.includes("members.manage");

  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => a.user_email.localeCompare(b.user_email));
  }, [members]);

  const activeCount = useMemo(() => members.filter((member) => member.status === "active").length, [members]);
  const disabledCount = useMemo(
    () => members.filter((member) => member.status === "disabled").length,
    [members]
  );

  const loadMembers = useCallback(async (companyId: string) => {
    setLoadingMembers(true);
    try {
      const data = await fetchCompanyMembers(companyId);
      setMembers(data);
    } catch (err) {
      setErrorBanner(formatApiError(err, "Could not load team members."));
    } finally {
      setLoadingMembers(false);
    }
  }, []);

  useEffect(() => {
    if (!activeCompany) return;
    void loadMembers(activeCompany.id);
  }, [activeCompany, loadMembers]);

  async function handleCreate(payload: TeamMemberCreatePayload) {
    if (!activeCompany || !canManageMembers) return;
    setCreatePending(true);
    setErrorBanner("");
    setSuccessBanner("");
    try {
      const created = await createCompanyMemberUser(activeCompany.id, payload);
      setMembers((prev) => [created, ...prev.filter((member) => member.id !== created.id)]);
      setSuccessBanner(`Created team member: ${created.user_email}`);
    } catch (err) {
      setErrorBanner(formatApiError(err, "Could not create team member."));
    } finally {
      setCreatePending(false);
    }
  }

  async function handleResetPassword(member: CompanyMember) {
    if (!activeCompany || !canManageMembers) return;
    const nextPassword = window.prompt(
      `Set a new password for ${member.user_email} (minimum 8 characters):`,
      ""
    );
    if (nextPassword === null) return;
    if (nextPassword.length < 8) {
      setErrorBanner("Password must be at least 8 characters.");
      return;
    }

    setActionPendingUserId(member.user);
    setErrorBanner("");
    setSuccessBanner("");
    try {
      await resetCompanyMemberPassword(activeCompany.id, member.user, nextPassword);
      setSuccessBanner(`Password reset for ${member.user_email}.`);
    } catch (err) {
      setErrorBanner(formatApiError(err, "Could not reset password."));
    } finally {
      setActionPendingUserId(null);
    }
  }

  async function handleToggleStatus(member: CompanyMember) {
    if (!activeCompany || !canManageMembers) return;

    const nextStatus = member.status === "disabled" ? "active" : "disabled";
    const confirmation = window.confirm(
      nextStatus === "disabled"
        ? `Disable ${member.user_email}? They will lose active company access.`
        : `Activate ${member.user_email}?`
    );
    if (!confirmation) return;

    const previousMembers = members;
    setActionPendingUserId(member.user);
    setErrorBanner("");
    setSuccessBanner("");
    setMembers((prev) =>
      prev.map((item) => (item.id === member.id ? { ...item, status: nextStatus } : item))
    );

    try {
      const updated = await updateCompanyMemberStatus(activeCompany.id, member.user, nextStatus);
      setMembers((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setSuccessBanner(
        `${member.user_email} is now ${nextStatus === "active" ? "active" : "disabled"}.`
      );
    } catch (err) {
      setMembers(previousMembers);
      setErrorBanner(formatApiError(err, "Could not update member status."));
    } finally {
      setActionPendingUserId(null);
    }
  }

  async function handleChangeRole(member: CompanyMember) {
    if (!canManageMembers) return;
    setRoleModalMember(member);
  }

  async function handleSubmitRoleChange(nextRole: AssignableTeamRole) {
    if (!activeCompany || !canManageMembers || !roleModalMember) return;

    const previousMembers = members;
    setActionPendingUserId(roleModalMember.user);
    setErrorBanner("");
    setSuccessBanner("");
    setMembers((prev) =>
      prev.map((item) => (item.id === roleModalMember.id ? { ...item, roles: [nextRole] } : item))
    );

    try {
      const result = await replaceCompanyMemberRoles(activeCompany.id, roleModalMember.user, [nextRole]);
      setMembers((prev) =>
        prev.map((item) => (item.id === roleModalMember.id ? { ...item, roles: result.roles } : item))
      );
      setSuccessBanner(`Updated role for ${roleModalMember.user_email} to ${nextRole}.`);
      setRoleModalMember(null);
    } catch (err) {
      setMembers(previousMembers);
      setErrorBanner(formatApiError(err, "Could not update member role."));
    } finally {
      setActionPendingUserId(null);
    }
  }

  async function handleRemoveMember(member: CompanyMember) {
    if (!activeCompany || !canManageMembers) return;

    const confirmed = window.confirm(
      `Remove ${member.user_email} from ${activeCompany.name}? This will disable membership and revoke roles.`
    );
    if (!confirmed) return;

    const previousMembers = members;
    setActionPendingUserId(member.user);
    setErrorBanner("");
    setSuccessBanner("");
    setMembers((prev) => prev.filter((item) => item.id !== member.id));

    try {
      await removeCompanyMember(activeCompany.id, member.user);
      setSuccessBanner(`Removed ${member.user_email} from this company.`);
      if (roleModalMember?.id === member.id) {
        setRoleModalMember(null);
      }
    } catch (err) {
      setMembers(previousMembers);
      setErrorBanner(formatApiError(err, "Could not remove member."));
    } finally {
      setActionPendingUserId(null);
    }
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading...
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
        title="Team Settings"
        description="Create and manage users in your company workspace."
        breadcrumbs={[
          { label: "Settings", href: getCompanyTeamSettingsPath(activeCompany.slug) },
          { label: "Team" },
        ]}
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card px-4 py-3 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Members</p>
          <p className="mt-1 text-lg font-semibold text-foreground tabular-nums">{members.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Active</p>
          <p className="mt-1 text-lg font-semibold text-foreground tabular-nums">{activeCount}</p>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Disabled</p>
          <p className="mt-1 text-lg font-semibold text-foreground tabular-nums">{disabledCount}</p>
        </div>
      </div>

      {!canManageMembers && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          You have read-only access. Owner or Admin role is required to manage team members.
        </div>
      )}

      {errorBanner && (
        <div className="mb-4 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2">
          <p className="text-sm text-destructive">{errorBanner}</p>
        </div>
      )}

      {successBanner && (
        <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
          <p className="text-sm text-emerald-700">{successBanner}</p>
        </div>
      )}

      <div className="space-y-4">
        <TeamMemberCreateForm
          canManageMembers={canManageMembers}
          isSubmitting={createPending}
          onCreate={handleCreate}
        />

        {loadingMembers ? (
          <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading team members...
            </div>
          </section>
        ) : (
          <TeamMembersTable
            members={sortedMembers}
            canManageMembers={canManageMembers}
            actionPendingUserId={actionPendingUserId}
            onChangeRole={handleChangeRole}
            onResetPassword={handleResetPassword}
            onToggleStatus={handleToggleStatus}
            onRemoveMember={handleRemoveMember}
          />
        )}
      </div>

      <TeamMemberRoleModal
        key={roleModalMember?.id ?? "no-member"}
        open={Boolean(roleModalMember)}
        member={roleModalMember}
        pending={actionPendingUserId === roleModalMember?.user}
        onClose={() => setRoleModalMember(null)}
        onSubmit={handleSubmitRoleChange}
      />
    </AppShell>
  );
}
