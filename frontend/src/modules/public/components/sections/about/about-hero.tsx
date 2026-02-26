export function AboutHeroSection() {
  return (
    <section className="bg-[var(--public-hero-gradient)] py-20 sm:py-24">
      <div className="mx-auto max-w-[1200px] px-6 text-center sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--public-primary)]">
          About UrAccount
        </p>
        <h1 className="mt-4 [font-family:var(--font-public-head)] text-4xl font-semibold tracking-tight text-[var(--public-text)] sm:text-5xl">
          Built by finance operators and software engineers
        </h1>
        <p className="mx-auto mt-5 max-w-[760px] text-lg leading-8 text-[var(--public-text-muted)]">
          Our mission is to help teams close faster, report with confidence, and keep every
          financial decision grounded in reliable data.
        </p>
      </div>
    </section>
  );
}

