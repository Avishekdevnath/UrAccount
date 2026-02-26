"use client";

import { Loader2 } from "lucide-react";

import type { CompanyMember } from "@/lib/api-types";

type TeamMembersTableProps = {
  members: CompanyMember[];
  canManageMembers: boolean;
  actionPendingUserId: string | null;
  onResetPassword: (member: CompanyMember) => void;
  onToggleStatus: (member: CompanyMember) => void;
  onChangeRole: (member: CompanyMember) => void;
  onRemoveMember: (member: CompanyMember) => void;
};

export function TeamMembersTable({
  members,
  canManageMembers,
  actionPendingUserId,
  onResetPassword,
  onToggleStatus,
  onChangeRole,
  onRemoveMember,
}: TeamMembersTableProps) {
  return (
    <section className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Team Members</h2>
      </div>

      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/40">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">User</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Roles</th>
            <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {members.length === 0 ? (
            <tr>
              <td colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                No team members found.
              </td>
            </tr>
          ) : (
            members.map((member) => {
              const pending = actionPendingUserId === member.user;
              const roles = member.roles?.length ? member.roles : ["-"];
              const isDisabled = member.status === "disabled";
              const hasOwnerRole = roles.includes("Owner");
              return (
                <tr key={member.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{member.user_email}</p>
                    <p className="text-xs text-muted-foreground">{member.user_full_name || "-"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {roles.map((role) => (
                        <span key={`${member.id}-${role}`} className="rounded-full bg-muted px-2 py-0.5 text-xs text-foreground">
                          {role}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                        isDisabled ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${isDisabled ? "bg-red-500" : "bg-emerald-500"}`} />
                      {member.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {pending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => onChangeRole(member)}
                            disabled={!canManageMembers || hasOwnerRole}
                            className="cursor-pointer rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-accent disabled:opacity-50"
                          >
                            Change Role
                          </button>
                          <button
                            type="button"
                            onClick={() => onResetPassword(member)}
                            disabled={!canManageMembers || isDisabled}
                            className="cursor-pointer rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-accent disabled:opacity-50"
                          >
                            Reset Password
                          </button>
                          <button
                            type="button"
                            onClick={() => onToggleStatus(member)}
                            disabled={!canManageMembers}
                            className={`cursor-pointer rounded-md border px-2.5 py-1 text-xs font-medium disabled:opacity-50 ${
                              isDisabled
                                ? "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                : "border-red-200 text-red-700 hover:bg-red-50"
                            }`}
                          >
                            {isDisabled ? "Activate" : "Disable"}
                          </button>
                          <button
                            type="button"
                            onClick={() => onRemoveMember(member)}
                            disabled={!canManageMembers || hasOwnerRole}
                            className="cursor-pointer rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                          >
                            Remove
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </section>
  );
}
