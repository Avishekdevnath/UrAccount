import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { openJobs } from "@/modules/public/data/careers";
import { PublicSection } from "@/modules/public/components/shared/public-section";
import { PublicSectionHead } from "@/modules/public/components/shared/public-section-head";

export function OpenRolesSection() {
  return (
    <PublicSection background="surface">
      <PublicSectionHead
        label="Open Roles"
        title="Current openings"
        subtitle="All roles are remote-first unless otherwise noted."
      />

      <div className="space-y-3">
        {openJobs.map((job) => (
          <article
            key={job.id}
            className="flex flex-col gap-4 rounded-xl border border-[var(--public-border)] bg-white p-5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--public-primary)]">
                {job.department}
              </p>
              <h3 className="mt-1 [font-family:var(--font-public-head)] text-xl font-semibold text-[var(--public-text)]">
                {job.title}
              </h3>
              <p className="mt-2 text-sm text-[var(--public-text-muted)]">
                {job.location} · {job.employmentType} · {job.salaryRange}
              </p>
            </div>
            <Button asChild variant="outline" className="border-[var(--public-border)] sm:self-start">
              <Link href="/contact">
                Apply <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </article>
        ))}
      </div>
    </PublicSection>
  );
}

