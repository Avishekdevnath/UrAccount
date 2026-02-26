import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";

export function HomeHeroSection() {
  return (
    <section className="relative overflow-hidden bg-[var(--public-hero-gradient)]">
      <div className="mx-auto grid max-w-[1200px] gap-10 px-6 py-20 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-blue-200/80 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--public-primary)]">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Trusted by Finance Teams
          </p>
          <h1 className="mt-5 max-w-[640px] [font-family:var(--font-public-head)] text-4xl font-bold leading-[1.1] tracking-tight text-[var(--public-text)] sm:text-5xl lg:text-[56px]">
            Finance clarity,
            <br />
            <span className="text-[var(--public-primary)]">without the chaos</span>
          </h1>
          <p className="mt-6 max-w-[620px] text-lg leading-8 text-[var(--public-text-muted)]">
            UrAccount gives finance teams a structured, audit-ready platform for accounting,
            reconciliation, and reporting, so you can spend less time fixing numbers and more
            time using them.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="bg-[var(--public-primary)] hover:bg-[var(--public-primary-hover)]">
              <Link href="/contact">
                Start Free Trial <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-[var(--public-border)] bg-white">
              <Link href="/features">View Features</Link>
            </Button>
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-4 text-sm text-[var(--public-text-muted)]">
            {["SOC 2 Type II", "99.9% Uptime SLA", "GDPR Compliant"].map((item) => (
              <span key={item} className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="hidden rounded-2xl border border-blue-100 bg-white p-5 shadow-[0_10px_36px_rgba(37,99,235,0.15)] lg:block">
          <p className="text-sm font-semibold text-[var(--public-text-muted)]">
            UrAccount · Financial Overview
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-blue-50 p-3">
              <p className="text-xs text-blue-900/70">Cash Position</p>
              <p className="mt-1 [font-family:var(--font-public-mono)] text-xl font-semibold text-blue-800">
                $284,590
              </p>
            </div>
            <div className="rounded-xl bg-amber-50 p-3">
              <p className="text-xs text-amber-900/70">A/R Outstanding</p>
              <p className="mt-1 [font-family:var(--font-public-mono)] text-xl font-semibold text-amber-700">
                $47,820
              </p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-3">
              <p className="text-xs text-emerald-900/70">Net Income</p>
              <p className="mt-1 [font-family:var(--font-public-mono)] text-xl font-semibold text-emerald-700">
                $31,250
              </p>
            </div>
          </div>
          <div className="mt-5">
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--public-text-muted)]">
              Revenue Last 8 Months
            </p>
            <div className="mt-2 flex h-28 items-end gap-2 rounded-xl border border-[var(--public-border)] bg-[var(--public-surface-alt)] p-3">
              {[35, 52, 45, 65, 58, 72, 80, 95].map((height, idx) => (
                <div
                  key={`${height}-${idx}`}
                  className="w-full rounded-sm bg-blue-400/80 last:bg-blue-600"
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

