import type { ReactNode } from "react";

import { PublicFooter } from "@/modules/public/components/layout/public-footer";
import { PublicHeader } from "@/modules/public/components/layout/public-header";

type PublicShellProps = {
  children: ReactNode;
};

export function PublicShell({ children }: PublicShellProps) {
  return (
    <div className="public-site min-h-screen bg-[var(--public-bg)] text-[var(--public-text)]">
      <PublicHeader />
      <main>{children}</main>
      <PublicFooter />
    </div>
  );
}

