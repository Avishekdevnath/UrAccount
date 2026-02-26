const trustItems = [
  "AES-256 Encryption",
  "SOC 2 Type II",
  "GDPR Compliant",
  "99.9% Uptime SLA",
  "Open Banking Ready",
];

export function TrustStrip() {
  return (
    <section className="border-y border-[var(--public-border)] bg-[var(--public-surface)]">
      <div className="mx-auto max-w-[1200px] px-6 py-5 sm:px-8">
        <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-medium text-[var(--public-text-muted)]">
          {trustItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

