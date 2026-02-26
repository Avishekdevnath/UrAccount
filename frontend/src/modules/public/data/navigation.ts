export type PublicNavItem = {
  label: string;
  href: string;
};

export type FooterLinkGroup = {
  title: string;
  links: PublicNavItem[];
};

export const publicNavItems: PublicNavItem[] = [
  { label: "Home", href: "/" },
  { label: "Features", href: "/features" },
  { label: "About", href: "/about" },
  { label: "Careers", href: "/careers" },
  { label: "Contact", href: "/contact" },
];

export const footerLinkGroups: FooterLinkGroup[] = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/features" },
      { label: "Accounting Core", href: "/features" },
      { label: "Reporting", href: "/features" },
      { label: "Reconciliation", href: "/features" },
      { label: "Pricing", href: "/contact" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Careers", href: "/careers" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Documentation", href: "/contact" },
      { label: "Help Center", href: "/contact" },
      { label: "API Reference", href: "/contact" },
      { label: "Status Page", href: "/contact" },
      { label: "Security", href: "/contact" },
    ],
  },
];

