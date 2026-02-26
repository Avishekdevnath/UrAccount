import { careerCultureItems } from "@/modules/public/data/careers";
import { PublicIcon } from "@/modules/public/components/shared/public-icon";
import { PublicSection } from "@/modules/public/components/shared/public-section";
import { PublicSectionHead } from "@/modules/public/components/shared/public-section-head";

export function CareersHeroSection() {
  return (
    <PublicSection background="surface">
      <PublicSectionHead
        align="center"
        label="Life at UrAccount"
        title="Build the infrastructure of better financial work"
        subtitle="We are solving real accounting operations problems with high ownership and disciplined product quality."
      />

      <div className="grid gap-4 md:grid-cols-3">
        {careerCultureItems.map((item) => (
          <article key={item.title} className="rounded-xl border border-[var(--public-border)] bg-white p-5">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--public-primary-soft)] text-[var(--public-primary)]">
              <PublicIcon name={item.icon} className="h-4 w-4" />
            </div>
            <h3 className="mt-4 [font-family:var(--font-public-head)] text-lg font-semibold text-[var(--public-text)]">
              {item.title}
            </h3>
            <p className="mt-2 text-sm leading-6 text-[var(--public-text-muted)]">{item.description}</p>
          </article>
        ))}
      </div>
    </PublicSection>
  );
}

