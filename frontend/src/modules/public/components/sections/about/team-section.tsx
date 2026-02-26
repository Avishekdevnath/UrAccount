import Link from "next/link";

import { Button } from "@/components/ui/button";
import { leadershipTeam } from "@/modules/public/data/company";
import { PublicSection } from "@/modules/public/components/shared/public-section";
import { PublicSectionHead } from "@/modules/public/components/shared/public-section-head";

export function TeamSection() {
  return (
    <PublicSection background="surface">
      <PublicSectionHead
        align="center"
        label="Leadership"
        title="The team behind UrAccount"
        subtitle="Cross-functional leadership from accounting, product, engineering, and operations."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {leadershipTeam.map((member) => (
          <article
            key={member.name}
            className="rounded-xl border border-[var(--public-border)] bg-white p-5 text-center shadow-[0_2px_8px_rgba(15,23,42,0.04)]"
          >
            <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-[var(--public-primary-soft)] text-lg font-semibold text-[var(--public-primary)]">
              {member.initials}
            </span>
            <h3 className="mt-4 [font-family:var(--font-public-head)] text-lg font-semibold text-[var(--public-text)]">
              {member.name}
            </h3>
            <p className="mt-1 text-sm text-[var(--public-text-muted)]">{member.role}</p>
          </article>
        ))}
      </div>

      <div className="mt-10 text-center">
        <Button asChild size="lg" className="bg-[var(--public-primary)] hover:bg-[var(--public-primary-hover)]">
          <Link href="/careers">Join Our Team</Link>
        </Button>
      </div>
    </PublicSection>
  );
}

