export function ContactHeroSection() {
  return (
    <section className="bg-[var(--public-hero-gradient)] py-16 text-center sm:py-20">
      <div className="mx-auto max-w-[1200px] px-6 sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--public-primary)]">
          Get In Touch
        </p>
        <h1 className="mt-4 [font-family:var(--font-public-head)] text-4xl font-semibold tracking-tight text-[var(--public-text)] sm:text-5xl">
          We would like to hear from you
        </h1>
        <p className="mx-auto mt-5 max-w-[700px] text-lg leading-8 text-[var(--public-text-muted)]">
          Whether you are ready to start, need a demo, or just have questions, our team responds quickly.
        </p>
      </div>
    </section>
  );
}

