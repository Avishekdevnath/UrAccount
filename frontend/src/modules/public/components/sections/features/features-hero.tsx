export function FeaturesHero() {
  return (
    <section className="bg-[var(--public-hero-gradient)] py-20 sm:py-24">
      <div className="mx-auto max-w-[1200px] px-6 text-center sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--public-primary)]">
          Platform Capabilities
        </p>
        <h1 className="mt-4 [font-family:var(--font-public-head)] text-4xl font-semibold tracking-tight text-[var(--public-text)] sm:text-5xl">
          Built for the full accounting cycle
        </h1>
        <p className="mx-auto mt-5 max-w-[700px] text-lg leading-8 text-[var(--public-text-muted)]">
          From journal entry to financial statement, UrAccount covers every step with structure,
          accuracy, and auditability.
        </p>
      </div>
    </section>
  );
}

