import { publicTestimonials } from "@/modules/public/data/testimonials";
import { PublicSection } from "@/modules/public/components/shared/public-section";
import { PublicSectionHead } from "@/modules/public/components/shared/public-section-head";

export function TestimonialsSection() {
  return (
    <PublicSection background="surface">
      <PublicSectionHead
        align="center"
        label="Social Proof"
        title="Finance teams that moved from chaos to clarity"
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {publicTestimonials.map((testimonial, idx) => (
          <article
            key={`${testimonial.author}-${idx}`}
            className="rounded-xl border border-[var(--public-border)] bg-white p-6 shadow-[0_2px_8px_rgba(15,23,42,0.04)]"
          >
            <p className="text-sm leading-7 text-[var(--public-text)]">“{testimonial.quote}”</p>
            <div className="mt-5 flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--public-primary-soft)] text-sm font-semibold text-[var(--public-primary)]">
                {testimonial.initials}
              </span>
              <div>
                <p className="text-sm font-semibold text-[var(--public-text)]">{testimonial.author}</p>
                <p className="text-xs text-[var(--public-text-muted)]">{testimonial.role}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </PublicSection>
  );
}

