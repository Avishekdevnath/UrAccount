import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PublicSectionProps = {
  children: ReactNode;
  className?: string;
  background?: "default" | "surface" | "alt";
  id?: string;
};

export function PublicSection({
  children,
  className,
  background = "default",
  id,
}: PublicSectionProps) {
  return (
    <section
      id={id}
      className={cn(
        "py-16 sm:py-20 lg:py-24",
        background === "surface" && "bg-[var(--public-surface)]",
        background === "alt" && "bg-[var(--public-surface-alt)]",
        className
      )}
    >
      <div className="mx-auto max-w-[1200px] px-6 sm:px-8">{children}</div>
    </section>
  );
}

