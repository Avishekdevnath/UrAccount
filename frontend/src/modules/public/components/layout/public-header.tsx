"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { publicNavItems } from "@/modules/public/data/navigation";

function isNavActive(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PublicHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--public-border)] bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between gap-4 px-6 sm:px-8">
        <Link href="/" className="inline-flex items-center gap-2.5 no-underline hover:no-underline">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--public-primary)] [background-image:var(--public-cta-gradient)] text-white">
            <Building2 className="h-4 w-4" />
          </span>
          <span className="text-lg font-semibold tracking-tight text-[var(--public-text)] [font-family:var(--font-public-head)]">
            UrAccount
          </span>
        </Link>

        <nav aria-label="Main navigation" className="hidden items-center gap-1 md:flex">
          {publicNavItems.map((item) => {
            const active = isNavActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium no-underline transition-colors hover:no-underline",
                  active
                    ? "bg-[var(--public-primary-soft)] text-[var(--public-primary)]"
                    : "text-[var(--public-text-muted)] hover:bg-[var(--public-primary-soft)]/70 hover:text-[var(--public-primary)]"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="hidden border-[var(--public-border)] md:inline-flex">
            <Link href="/contact">Book Demo</Link>
          </Button>
          <Button asChild size="sm" className="bg-[var(--public-primary)] hover:bg-[var(--public-primary-hover)]">
            <Link href="/login">Sign In</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
