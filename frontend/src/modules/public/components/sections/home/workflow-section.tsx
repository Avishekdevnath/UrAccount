import { PublicSection } from "@/modules/public/components/shared/public-section";
import { PublicSectionHead } from "@/modules/public/components/shared/public-section-head";

const workflowSteps = [
  {
    step: "01",
    title: "Capture",
    description: "Import transactions, record expenses, and receive invoices in one place.",
  },
  {
    step: "02",
    title: "Post",
    description: "Review and post entries to the ledger with strict double-entry control.",
  },
  {
    step: "03",
    title: "Reconcile",
    description: "Match bank statements, resolve exceptions, and finalize periods.",
  },
  {
    step: "04",
    title: "Report",
    description: "Generate audit-ready statements and operational views on demand.",
  },
];

export function WorkflowSection() {
  return (
    <PublicSection background="alt">
      <PublicSectionHead
        align="center"
        label="How It Works"
        title="A structured cycle from capture to close"
        subtitle="UrAccount follows the accounting cycle your team already knows, just faster and more reliable."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {workflowSteps.map((step) => (
          <article
            key={step.step}
            className="rounded-xl border border-[var(--public-border)] bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.04)]"
          >
            <p className="text-xs font-semibold tracking-[0.1em] text-[var(--public-primary)]">{step.step}</p>
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

