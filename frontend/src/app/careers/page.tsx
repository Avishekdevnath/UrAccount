import type { Metadata } from "next";

import { PublicShell } from "@/modules/public/components/layout/public-shell";
import { BenefitsSection } from "@/modules/public/components/sections/careers/benefits-section";
import { CareersHeroSection } from "@/modules/public/components/sections/careers/careers-hero";
import { HiringProcessSection } from "@/modules/public/components/sections/careers/hiring-process-section";
import { OpenRolesSection } from "@/modules/public/components/sections/careers/open-roles-section";
import { PublicCtaBand } from "@/modules/public/components/shared/public-cta-band";

export const metadata: Metadata = {
  title: "Careers | UrAccount",
  description:
    "Join the UrAccount team and build accounting infrastructure that helps finance teams operate with confidence.",
};

export default function CareersPage() {
  return (
    <PublicShell>
      <CareersHeroSection />
      <BenefitsSection />
      <OpenRolesSection />
      <HiringProcessSection />
      <PublicCtaBand
        title="Do not see your role listed?"
        description="We are always interested in exceptional builders and operators."
        primaryLabel="Get in Touch"
        primaryHref="/contact"
      />
    </PublicShell>
  );
}

