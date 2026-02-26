import { homeCoreCapabilities } from "@/modules/public/data/feature-groups";
import { PublicIcon } from "@/modules/public/components/shared/public-icon";
import { PublicSection } from "@/modules/public/components/shared/public-section";
import { PublicSectionHead } from "@/modules/public/components/shared/public-section-head";

export function CoreCapabilitiesSection() {
  return (
    <PublicSection background="surface">
      <PublicSectionHead
        align="center"
        label="Core Capabilities"
        title="Everything your finance team needs, structured and ready"
        subtitle="UrAccount covers the full accounting cycle from transaction capture to audit export in a single platform."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {homeCoreCapabilities.map((item) => (
          <article
            key={item.title}
            className="rounded-xl border border-[var(--public-border)] bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.04)]"
          >
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

