"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { formatApiError, systemBootstrapCompany } from "@/lib/api-client";
import type { SystemCompanyBootstrapInput, SystemCompanyBootstrapResult } from "@/lib/api-types";

type CompanyBootstrapWizardProps = {
  onSuccess?: (result: SystemCompanyBootstrapResult) => void;
};

type FormState = {
  companyName: string;
  companySlug: string;
  baseCurrency: string;
  timezone: string;
  fiscalYearStartMonth: number;
  ownerEmail: string;
  ownerFullName: string;
  ownerPassword: string;
  createNewOwner: boolean;
};

const DEFAULT_STATE: FormState = {
  companyName: "",
  companySlug: "",
  baseCurrency: "USD",
  timezone: "UTC",
  fiscalYearStartMonth: 1,
  ownerEmail: "",
  ownerFullName: "",
  ownerPassword: "",
  createNewOwner: true,
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function CompanyBootstrapWizard({ onSuccess }: CompanyBootstrapWizardProps) {
  const [form, setForm] = useState<FormState>(DEFAULT_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>("");
  const [result, setResult] = useState<SystemCompanyBootstrapResult | null>(null);

  const canSubmit = useMemo(() => {
    if (!form.companyName || !form.companySlug || !form.ownerEmail) {
      return false;
    }
    if (form.createNewOwner && (!form.ownerFullName || form.ownerPassword.length < 8)) {
      return false;
    }
    return true;
  }, [form]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResult(null);
    setIsSubmitting(true);

    const payload: SystemCompanyBootstrapInput = {
      company: {
        name: form.companyName,
        slug: form.companySlug,
        base_currency: form.baseCurrency,
        timezone: form.timezone,
        fiscal_year_start_month: form.fiscalYearStartMonth,
      },
      owner: {
        email: form.ownerEmail,
      },
    };

    if (form.createNewOwner) {
      payload.owner.full_name = form.ownerFullName;
      payload.owner.password = form.ownerPassword;
    }

    try {
      const created = await systemBootstrapCompany(payload);
      setResult(created);
      onSuccess?.(created);
    } catch (submitError) {
      setError(formatApiError(submitError, "Failed to bootstrap company."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="text-base font-semibold text-foreground">Company Bootstrap Wizard</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Create a company and attach the first owner account in one transaction.
      </p>

      <form
        className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2"
        onSubmit={handleSubmit}
        data-testid="company-bootstrap-form"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Company name</span>
          <input
            required
            value={form.companyName}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                companyName: e.target.value,
                companySlug: prev.companySlug || slugify(e.target.value),
              }))
            }
            className="rounded-md border border-input bg-background px-3 py-2"
            data-testid="company-name-input"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Company slug</span>
          <input
            required
            value={form.companySlug}
            onChange={(e) => setForm((prev) => ({ ...prev, companySlug: slugify(e.target.value) }))}
            className="rounded-md border border-input bg-background px-3 py-2"
            data-testid="company-slug-input"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Base currency</span>
          <input
            value={form.baseCurrency}
            maxLength={3}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, baseCurrency: e.target.value.toUpperCase().slice(0, 3) }))
            }
            className="rounded-md border border-input bg-background px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Timezone</span>
          <input
            value={form.timezone}
            onChange={(e) => setForm((prev) => ({ ...prev, timezone: e.target.value }))}
            className="rounded-md border border-input bg-background px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Fiscal year start month</span>
          <input
            type="number"
            min={1}
            max={12}
            value={form.fiscalYearStartMonth}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, fiscalYearStartMonth: Number(e.target.value) || 1 }))
            }
            className="rounded-md border border-input bg-background px-3 py-2"
          />
        </label>

        <label className="md:col-span-2 inline-flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={form.createNewOwner}
            onChange={(e) => setForm((prev) => ({ ...prev, createNewOwner: e.target.checked }))}
            className="h-4 w-4 rounded border-input accent-primary"
          />
          Create a new owner user (unchecked = link existing owner by email)
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Owner email</span>
          <input
            type="email"
            required
            value={form.ownerEmail}
            onChange={(e) => setForm((prev) => ({ ...prev, ownerEmail: e.target.value.trim() }))}
            className="rounded-md border border-input bg-background px-3 py-2"
            data-testid="owner-email-input"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Owner full name</span>
          <input
            disabled={!form.createNewOwner}
            required={form.createNewOwner}
            value={form.ownerFullName}
            onChange={(e) => setForm((prev) => ({ ...prev, ownerFullName: e.target.value }))}
            className="rounded-md border border-input bg-background px-3 py-2 disabled:opacity-60"
            data-testid="owner-full-name-input"
          />
        </label>

        <label className="md:col-span-2 flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Owner password</span>
          <input
            type="password"
            disabled={!form.createNewOwner}
            required={form.createNewOwner}
            minLength={8}
            value={form.ownerPassword}
            onChange={(e) => setForm((prev) => ({ ...prev, ownerPassword: e.target.value }))}
            className="rounded-md border border-input bg-background px-3 py-2 disabled:opacity-60"
            data-testid="owner-password-input"
          />
        </label>

        {error ? (
          <div
            className="md:col-span-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            data-testid="company-bootstrap-error"
          >
            {error}
          </div>
        ) : null}

        {result ? (
          <div
            className="md:col-span-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
            data-testid="company-bootstrap-success"
          >
            Created company <strong>{result.company_slug}</strong> with owner <strong>{result.owner_email}</strong>.
          </div>
        ) : null}

        <div className="md:col-span-2 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setForm(DEFAULT_STATE);
              setError("");
              setResult(null);
            }}
            className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent"
          >
            Reset
          </button>
          <button
            type="submit"
            disabled={!canSubmit || isSubmitting}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            data-testid="company-bootstrap-submit"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Create Company
          </button>
        </div>
      </form>
    </section>
  );
}
