"use client";

import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";
import { featureGroups } from "@/modules/public/data/feature-groups";
import { PublicIcon } from "@/modules/public/components/shared/public-icon";
import { PublicSection } from "@/modules/public/components/shared/public-section";

export function FeatureTabsSection() {
  const [activeGroupId, setActiveGroupId] = useState(featureGroups[0]?.id ?? "accounting");
  const activeGroup = useMemo(
    () => featureGroups.find((group) => group.id === activeGroupId) ?? featureGroups[0],
    [activeGroupId]
  );

  if (!activeGroup) {
    return null;
  }

  return (
    <PublicSection background="surface">
      <div
        role="tablist"
        aria-label="Feature categories"
        className="mb-8 flex flex-wrap gap-2 rounded-xl border border-[var(--public-border)] bg-[var(--public-surface-alt)] p-2"
      >
        {featureGroups.map((group) => {
          const isActive = group.id === activeGroupId;
          return (
            <button
              key={group.id}
              role="tab"
              aria-selected={isActive}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-white text-[var(--public-primary)] shadow-sm"
                  : "text-[var(--public-text-muted)] hover:text-[var(--public-text)]"
              )}
              onClick={() => setActiveGroupId(group.id)}
            >
              {group.tabLabel}
            </button>
          );
        })}
      </div>

      <header className="mb-7">
        <h2 className="[font-family:var(--font-public-head)] text-3xl font-semibold tracking-tight text-[var(--public-text)]">
          {activeGroup.title}
        </h2>
        <p className="mt-3 max-w-[760px] text-lg leading-7 text-[var(--public-text-muted)]">
          {activeGroup.subtitle}
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {activeGroup.items.map((item) => (
          <article key={item.title} className="rounded-xl border border-[var(--public-border)] bg-white p-5">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--public-primary-soft)] text-[var(--public-primary)]">
              <PublicIcon name={item.icon} className="h-4 w-4" />
            </div>
            <h3 className="mt-4 [font-family:var(--font-public-head)] text-lg font-semibold text-[var(--public-text)]">
              {item.title}
            </h3>
            <p className="mt-2 text-sm leading-6 text-[var(--public-text-muted)]">{item.description}</p>
          </article>
        ))}
      </div>
    </PublicSection>
  );
}

