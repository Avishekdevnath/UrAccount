import type { Metadata } from "next";
import { Geist, Geist_Mono, IBM_Plex_Mono, Manrope, Sora } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const publicHeadFont = Sora({
  variable: "--font-public-head",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const publicBodyFont = Manrope({
  variable: "--font-public-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const publicMonoFont = IBM_Plex_Mono({
  variable: "--font-public-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "UrAccount",
  description: "Modern accounting workspace for structured finance operations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${publicHeadFont.variable} ${publicBodyFont.variable} ${publicMonoFont.variable} antialiased`}
      >
        <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
      </body>
    </html>
  );
}
