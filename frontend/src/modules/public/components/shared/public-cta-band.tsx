import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PublicCtaBandProps = {
  title: string;
  description: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  className?: string;
};

export function PublicCtaBand({
  title,
  description,
  primaryLabel,
  primaryHref,
  secondaryLabel,
  secondaryHref,
  className,
}: PublicCtaBandProps) {
  return (
    <section className={cn("py-20", className)}>
      <div className="mx-auto max-w-[1200px] px-6 sm:px-8">
        <div className="overflow-hidden rounded-2xl border border-[var(--public-border)] bg-[var(--public-primary)] [background-image:var(--public-cta-gradient)] p-10 text-center shadow-[0_16px_48px_rgba(30,64,175,0.18)] sm:p-12">
          <h2 className="[font-family:var(--font-public-head)] text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            {title}
          </h2>
          <p className="mx-auto mt-4 max-w-[720px] text-base text-blue-100 sm:text-lg">
            {description}
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="bg-white text-[var(--public-primary)] hover:bg-blue-50">
              <Link href={primaryHref}>{primaryLabel}</Link>
            </Button>
            {secondaryLabel && secondaryHref ? (
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-blue-200 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                <Link href={secondaryHref}>{secondaryLabel}</Link>
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
