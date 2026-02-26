import Link from "next/link";
import { Building2 } from "lucide-react";

import { footerLinkGroups } from "@/modules/public/data/navigation";

export function PublicFooter() {
  return (
    <footer className="mt-16 border-t border-[var(--public-border)] bg-[var(--public-footer-bg)] text-[var(--public-footer-text)]">
      <div className="mx-auto max-w-[1200px] px-6 py-14 sm:px-8">
        <div className="grid gap-10 md:grid-cols-[1.3fr_1fr_1fr_1fr]">
          <div>
            <div className="inline-flex items-center gap-2.5">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--public-primary)] [background-image:var(--public-cta-gradient)] text-white">
                <Building2 className="h-4 w-4" />
              </span>
              <span className="[font-family:var(--font-public-head)] text-lg font-semibold text-white">UrAccount</span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-6 text-[var(--public-footer-text-muted)]">
              Structured accounting for modern finance teams. Built for accuracy, speed, and audit readiness.
            </p>
            <p className="mt-4 text-xs text-[var(--public-footer-text-muted)]">SOC 2 Type II · GDPR · 99.9% Uptime</p>
          </div>

          {footerLinkGroups.map((group) => (
            <div key={group.title}>
              <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-white">{group.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {group.links.map((link) => (
                  <li key={`${group.title}-${link.label}`}>
                    <Link
                      href={link.href}
                      className="text-sm text-[var(--public-footer-text-muted)] no-underline transition-colors hover:text-white hover:underline"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs text-[var(--public-footer-text-muted)] sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} UrAccount, Inc. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/contact" className="hover:text-white">Privacy Policy</Link>
            <Link href="/contact" className="hover:text-white">Terms of Service</Link>
            <Link href="/contact" className="hover:text-white">Cookie Settings</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
