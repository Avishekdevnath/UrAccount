import { careerBenefits } from "@/modules/public/data/careers";
import { PublicIcon } from "@/modules/public/components/shared/public-icon";
import { PublicSection } from "@/modules/public/components/shared/public-section";
import { PublicSectionHead } from "@/modules/public/components/shared/public-section-head";

export function BenefitsSection() {
  return (
    <PublicSection background="alt">
      <PublicSectionHead label="Benefits" title="What we offer" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {careerBenefits.map((benefit) => (
          <article key={benefit.title} className="rounded-xl border border-[var(--public-border)] bg-white p-5">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--public-primary-soft)] text-[var(--public-primary)]">
              <PublicIcon name={benefit.icon} className="h-4 w-4" />
            </div>
            <h3 className="mt-4 [font-family:var(--font-public-head)] text-lg font-semibold text-[var(--public-text)]">
              {benefit.title}
            </h3>
            <p className="mt-2 text-sm leading-6 text-[var(--public-text-muted)]">{benefit.description}</p>
          </article>
        ))}
      </div>
    </PublicSection>
  );
}

