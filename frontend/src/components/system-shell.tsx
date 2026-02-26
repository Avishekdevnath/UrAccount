"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Building2,
  Flag,
  LayoutDashboard,
  LogOut,
  Shield,
  Users,
} from "lucide-react";
import type { UserMe } from "@/lib/api-types";
import { cn } from "@/lib/utils";

type SystemShellProps = {
  user: UserMe;
  onLogout: () => void;
  children: ReactNode;
};

const NAV_ITEMS = [
  { label: "Dashboard", path: "/system", icon: LayoutDashboard, exact: true },
  { label: "Companies", path: "/system/companies", icon: Building2, exact: false },
  { label: "Users", path: "/system/users", icon: Users, exact: false },
  { label: "Audit Logs", path: "/system/audit-logs", icon: Activity, exact: false },
  { label: "Feature Flags", path: "/system/feature-flags", icon: Flag, exact: false },
];

export function SystemShell({ user, onLogout, children }: SystemShellProps) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="flex w-56 shrink-0 flex-col bg-sidebar border-r border-sidebar-border">
        {/* Brand */}
        <Link
          href="/system"
          className="flex h-14 items-center gap-2.5 px-5 border-b border-sidebar-border shrink-0 no-underline hover:no-underline"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-destructive">
            <Shield className="h-4 w-4 text-destructive-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight text-sidebar-foreground leading-none">System</p>
            <p className="text-[10px] text-sidebar-foreground/50 leading-none mt-0.5">Control Panel</p>
          </div>
        </Link>

        {/* Nav */}
        <nav className="flex flex-col gap-0.5 px-3 py-3 flex-1 overflow-y-auto" aria-label="System navigation">
          {NAV_ITEMS.map((item) => {
            const isActive = item.exact ? pathname === item.path : pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                href={item.path}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors no-underline hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer: user + logout */}
        <div className="shrink-0 border-t border-sidebar-border px-4 py-3">
          <p className="text-xs font-medium text-sidebar-foreground/70 truncate">{user.email}</p>
          <button
            type="button"
            onClick={onLogout}
            className="mt-1.5 flex cursor-pointer items-center gap-1.5 text-[11px] text-sidebar-foreground/40 transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Sign out"
          >
            <LogOut className="h-3 w-3" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Slim top bar */}
        <header className="flex h-14 items-center border-b border-border bg-card px-6 shrink-0">
          <p className="text-xs text-muted-foreground">
            Signed in as <span className="font-medium text-foreground">{user.email}</span>
          </p>
          <Link
            href="/app"
            className="ml-auto text-xs text-primary hover:underline"
          >
            ← Back to app
          </Link>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-6 py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
