"use client";

import type { ReactNode } from "react";
import { Building2 } from "lucide-react";
import type { Company, CompanyAccess, UserMe } from "@/lib/api-types";
import { SidebarNav } from "@/components/sidebar-nav";
import { TopBar } from "@/components/top-bar";

type AppShellProps = {
  user: UserMe;
  companies: Company[];
  activeCompany: Company;
  access: CompanyAccess;
  onLogout: () => void;
  onNavigate: (path: string) => void;
  children: ReactNode;
};

export function AppShell({
  user,
  companies,
  activeCompany,
  access: _access,
  onLogout,
  onNavigate,
  children,
}: AppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside
        className="flex w-60 shrink-0 flex-col bg-sidebar border-r border-sidebar-border"
        style={{ background: "var(--sidebar)" }}
      >
        {/* Logo / Brand */}
        <div className="flex h-14 items-center gap-2.5 px-5 border-b border-sidebar-border shrink-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
            <Building2 className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-base font-semibold tracking-tight text-sidebar-foreground">
            UrAccount
          </span>
        </div>

        {/* Navigation */}
        <SidebarNav companySlug={activeCompany.slug} onNavigate={onNavigate} />

        {/* Bottom: Company info */}
        <div className="shrink-0 border-t border-sidebar-border px-4 py-3">
          <p className="text-xs font-medium text-sidebar-foreground/70 truncate">{activeCompany.name}</p>
          <p className="text-[11px] text-sidebar-foreground/40 mt-0.5">{activeCompany.base_currency} · {activeCompany.slug}</p>
        </div>
      </aside>

      {/* ── Main area ───────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <TopBar
          user={user}
          companies={companies}
          activeCompany={activeCompany}
          onLogout={onLogout}
          onNavigate={onNavigate}
        />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-6 py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
