import type { Metadata } from "next";

import { PublicShell } from "@/modules/public/components/layout/public-shell";
import { ComparisonSection } from "@/modules/public/components/sections/features/comparison-section";
import { FeatureTabsSection } from "@/modules/public/components/sections/features/feature-tabs-section";
import { FeaturesHero } from "@/modules/public/components/sections/features/features-hero";
import { PublicCtaBand } from "@/modules/public/components/shared/public-cta-band";

export const metadata: Metadata = {
  title: "Features | UrAccount",
  description:
    "Explore UrAccount features across accounting, receivables, payables, banking, and financial reporting.",
};

export default function FeaturesPage() {
  return (
    <PublicShell>
      <FeaturesHero />
      <FeatureTabsSection />
      <ComparisonSection />
      <PublicCtaBand
        title="See UrAccount in your workflow"
        description="Book a guided walkthrough tailored to your accounting process."
        primaryLabel="Book a Demo"
        primaryHref="/contact"
      />
    </PublicShell>
  );
}

