import type { Metadata } from "next";

import { PublicShell } from "@/modules/public/components/layout/public-shell";
import { AboutHeroSection } from "@/modules/public/components/sections/about/about-hero";
import { PrinciplesSection } from "@/modules/public/components/sections/about/principles-section";
import { StoryTimelineSection } from "@/modules/public/components/sections/about/story-timeline-section";
import { TeamSection } from "@/modules/public/components/sections/about/team-section";
import { PublicCtaBand } from "@/modules/public/components/shared/public-cta-band";

export const metadata: Metadata = {
  title: "About | UrAccount",
  description:
    "Learn about UrAccount's mission, operating principles, and the team building modern accounting infrastructure.",
};

export default function AboutPage() {
  return (
    <PublicShell>
      <AboutHeroSection />
      <StoryTimelineSection />
      <PrinciplesSection />
      <TeamSection />
      <PublicCtaBand
        title="Want to build this future with us?"
        description="Explore open roles and help shape the next generation of accounting workflows."
        primaryLabel="View Careers"
        primaryHref="/careers"
      />
    </PublicShell>
  );
}

