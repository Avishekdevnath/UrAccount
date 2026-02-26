import { companyTimeline } from "@/modules/public/data/company";
import { PublicSection } from "@/modules/public/components/shared/public-section";
import { PublicSectionHead } from "@/modules/public/components/shared/public-section-head";

export function StoryTimelineSection() {
  return (
    <PublicSection background="surface">
      <PublicSectionHead
        label="Our Journey"
        title="From recurring pain to a structured accounting platform"
        subtitle="UrAccount evolved by solving practical finance operations problems, release by release."
      />

      <ol className="space-y-4">
        {companyTimeline.map((item) => (
          <li key={item.year} className="rounded-xl border border-[var(--public-border)] bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--public-primary)]">
              {item.year}
            </p>
            <h3 className="mt-2 [font-family:var(--font-public-head)] text-xl font-semibold text-[var(--public-text)]">
              {item.title}
            </h3>
            <p className="mt-2 text-sm leading-6 text-[var(--public-text-muted)]">{item.description}</p>
          </li>
        ))}
      </ol>
    </PublicSection>
  );
}

