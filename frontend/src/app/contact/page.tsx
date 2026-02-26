import type { Metadata } from "next";

import { PublicShell } from "@/modules/public/components/layout/public-shell";
import { ContactFormSection } from "@/modules/public/components/sections/contact/contact-form-section";
import { ContactHeroSection } from "@/modules/public/components/sections/contact/contact-hero";

export const metadata: Metadata = {
  title: "Contact | UrAccount",
  description:
    "Contact UrAccount for demos, sales questions, support, partnerships, and onboarding guidance.",
};

export default function ContactPage() {
  return (
    <PublicShell>
      <ContactHeroSection />
      <ContactFormSection />
    </PublicShell>
  );
}

