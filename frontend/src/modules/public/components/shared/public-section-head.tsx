import { cn } from "@/lib/utils";

type PublicSectionHeadProps = {
  label?: string;
  title: string;
  subtitle?: string;
  align?: "left" | "center";
  className?: string;
};

export function PublicSectionHead({
  label,
  title,
  subtitle,
  align = "left",
  className,
}: PublicSectionHeadProps) {
  const centered = align === "center";

  return (
    <header className={cn("mb-12", centered && "text-center", className)}>
      {label ? (
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--public-primary)]">
          {label}
        </p>
      ) : null}
      <h2
        className={cn(
          "text-[32px] leading-[40px] font-semibold tracking-tight [font-family:var(--font-public-head)] text-[var(--public-text)] sm:text-[36px] sm:leading-[44px]"
        )}
      >
        {title}
      </h2>
      {subtitle ? (
        <p
          className={cn(
            "mt-4 max-w-[640px] text-lg leading-7 text-[var(--public-text-muted)]",
            centered && "mx-auto"
          )}
        >
          {subtitle}
        </p>
      ) : null}
    </header>
  );
}

