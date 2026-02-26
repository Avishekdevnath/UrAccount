"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

type TeamMemberCreatePayload = {
  email: string;
  full_name: string;
  password: string;
  role: "Admin" | "Accountant" | "Viewer";
};

type TeamMemberCreateFormProps = {
  canManageMembers: boolean;
  isSubmitting: boolean;
  onCreate: (payload: TeamMemberCreatePayload) => Promise<void>;
};

const INITIAL_FORM: TeamMemberCreatePayload = {
  email: "",
  full_name: "",
  password: "",
  role: "Viewer",
};

export function TeamMemberCreateForm({
  canManageMembers,
  isSubmitting,
  onCreate,
}: TeamMemberCreateFormProps) {
  const [form, setForm] = useState<TeamMemberCreatePayload>(INITIAL_FORM);

  const canSubmit = useMemo(() => {
    if (!canManageMembers) return false;
    return Boolean(form.email && form.full_name && form.password.length >= 8);
  }, [canManageMembers, form]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    await onCreate(form);
    setForm(INITIAL_FORM);
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-foreground">Create Team Member</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Owner/Admin can create users and assign an initial role.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground md:col-span-1">
          Email
          <input
            type="email"
            value={form.email}
            disabled={!canManageMembers || isSubmitting}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value.trim().toLowerCase() }))}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
            required
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-muted-foreground md:col-span-1">
          Full name
          <input
            value={form.full_name}
            disabled={!canManageMembers || isSubmitting}
            onChange={(e) => setForm((prev) => ({ ...prev, full_name: e.target.value }))}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
            required
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-muted-foreground md:col-span-1">
          Temporary password
          <input
            type="password"
            minLength={8}
            value={form.password}
            disabled={!canManageMembers || isSubmitting}
            onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
            required
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-muted-foreground md:col-span-1">
          Role
          <select
            value={form.role}
            disabled={!canManageMembers || isSubmitting}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                role: e.target.value as TeamMemberCreatePayload["role"],
              }))
            }
            className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          >
            <option value="Viewer">Viewer</option>
            <option value="Accountant">Accountant</option>
            <option value="Admin">Admin</option>
          </select>
        </label>

        <div className="md:col-span-2 flex justify-end">
          <button
            type="submit"
            disabled={!canSubmit || isSubmitting}
            className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Create member
          </button>
        </div>
      </form>
    </section>
  );
}
