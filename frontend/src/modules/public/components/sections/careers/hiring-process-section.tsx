import { hiringSteps } from "@/modules/public/data/careers";
import { PublicSection } from "@/modules/public/components/shared/public-section";
import { PublicSectionHead } from "@/modules/public/components/shared/public-section-head";

export function HiringProcessSection() {
  return (
    <PublicSection background="alt">
      <PublicSectionHead
        align="center"
        label="Hiring Process"
        title="A process that respects your time"
        subtitle="Most candidates complete this process in 2-3 weeks with clear feedback throughout."
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {hiringSteps.map((step) => (
          <article key={step.step} className="rounded-xl border border-[var(--public-border)] bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--public-primary)]">
              Step {step.step}
            </p>
            <h3 className="mt-2 [font-family:var(--font-public-head)] text-lg font-semibold text-[var(--public-text)]">
              {step.title}
            </h3>
            <p className="mt-2 text-sm leading-6 text-[var(--public-text-muted)]">{step.description}</p>
          </article>
        ))}
      </div>
    </PublicSection>
  );
}

