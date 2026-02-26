import { operatingPrinciples } from "@/modules/public/data/company";
import { PublicIcon } from "@/modules/public/components/shared/public-icon";
import { PublicSection } from "@/modules/public/components/shared/public-section";
import { PublicSectionHead } from "@/modules/public/components/shared/public-section-head";

export function PrinciplesSection() {
  return (
    <PublicSection background="alt">
      <PublicSectionHead
        align="center"
        label="How We Work"
        title="Operating principles"
        subtitle="These principles shape every product decision and every customer workflow."
      />

      <div className="grid gap-4 md:grid-cols-3">
        {operatingPrinciples.map((principle) => (
          <article
            key={principle.title}
            className="rounded-xl border border-[var(--public-border)] bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.04)]"
          >
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--public-primary-soft)] text-[var(--public-primary)]">
              <PublicIcon name={principle.icon} className="h-4 w-4" />
            </div>
            <h3 className="mt-4 [font-family:var(--font-public-head)] text-lg font-semibold text-[var(--public-text)]">
              {principle.title}
            </h3>
            <p className="mt-2 text-sm leading-6 text-[var(--public-text-muted)]">{principle.description}</p>
          </article>
        ))}
      </div>
    </PublicSection>
  );
}

