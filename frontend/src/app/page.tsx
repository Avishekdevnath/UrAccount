import type { Metadata } from "next";

import { PublicShell } from "@/modules/public/components/layout/public-shell";
import { CoreCapabilitiesSection } from "@/modules/public/components/sections/home/core-capabilities-section";
import { HomeHeroSection } from "@/modules/public/components/sections/home/hero-section";
import { TestimonialsSection } from "@/modules/public/components/sections/home/testimonials-section";
import { TrustStrip } from "@/modules/public/components/sections/home/trust-strip";
import { WorkflowSection } from "@/modules/public/components/sections/home/workflow-section";
import { PublicCtaBand } from "@/modules/public/components/shared/public-cta-band";

export const metadata: Metadata = {
  title: "UrAccount | Finance Intelligence for Modern Teams",
  description:
    "UrAccount gives finance teams clarity, control, and confidence with structured accounting and audit-ready reporting.",
};

export default function HomePage() {
  return (
    <PublicShell>
      <HomeHeroSection />
      <TrustStrip />
      <CoreCapabilitiesSection />
      <WorkflowSection />
      <TestimonialsSection />
      <PublicCtaBand
        title="Ready to bring structure to your finances?"
        description="Start your free trial today. No credit card required."
        primaryLabel="Start Free Trial"
        primaryHref="/contact"
        secondaryLabel="Talk to Sales"
        secondaryHref="/contact"
      />
    </PublicShell>
  );
}
