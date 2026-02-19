"use client";

import {
  BarChart3,
  BookOpen,
  Building2,
  ChevronDown,
  CreditCard,
  FileText,
  LayoutDashboard,
  Receipt,
  RefreshCw,
  Scale,
  ShoppingCart,
  TrendingUp,
  Upload,
  Users,
  Wallet,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  path: string;
  icon: React.ReactNode;
};

type NavGroup = {
  title: string;
  icon: React.ReactNode;
  items: NavItem[];
  matchSegment: string; // URL segment to detect active group
};

function buildNav(slug: string): NavGroup[] {
  const base = `/app/c/${slug}`;
  return [
    {
      title: "Accounting",
      icon: <BookOpen className="h-4 w-4" />,
      matchSegment: "accounting",
      items: [
        { label: "Chart of Accounts", path: `${base}/accounting/chart-of-accounts`, icon: <Scale className="h-3.5 w-3.5" /> },
        { label: "Journals", path: `${base}/accounting/journals`, icon: <FileText className="h-3.5 w-3.5" /> },
        { label: "Trial Balance", path: `${base}/accounting/trial-balance`, icon: <BarChart3 className="h-3.5 w-3.5" /> },
      ],
    },
    {
      title: "Sales",
      icon: <TrendingUp className="h-4 w-4" />,
      matchSegment: "sales",
      items: [
        { label: "Customers", path: `${base}/sales/customers`, icon: <Users className="h-3.5 w-3.5" /> },
        { label: "Invoices", path: `${base}/sales/invoices`, icon: <FileText className="h-3.5 w-3.5" /> },
        { label: "Receipts", path: `${base}/sales/receipts`, icon: <Receipt className="h-3.5 w-3.5" /> },
        { label: "AR Aging", path: `${base}/sales/ar-aging`, icon: <BarChart3 className="h-3.5 w-3.5" /> },
      ],
    },
    {
      title: "Purchases",
      icon: <ShoppingCart className="h-4 w-4" />,
      matchSegment: "purchases",
      items: [
        { label: "Vendors", path: `${base}/purchases/vendors`, icon: <Building2 className="h-3.5 w-3.5" /> },
        { label: "Bills", path: `${base}/purchases/bills`, icon: <FileText className="h-3.5 w-3.5" /> },
        { label: "Vendor Payments", path: `${base}/purchases/vendor-payments`, icon: <CreditCard className="h-3.5 w-3.5" /> },
        { label: "AP Aging", path: `${base}/purchases/ap-aging`, icon: <BarChart3 className="h-3.5 w-3.5" /> },
      ],
    },
    {
      title: "Banking",
      icon: <Wallet className="h-4 w-4" />,
      matchSegment: "banking",
      items: [
        { label: "Bank Accounts", path: `${base}/banking/accounts`, icon: <Building2 className="h-3.5 w-3.5" /> },
        { label: "Imports", path: `${base}/banking/imports`, icon: <Upload className="h-3.5 w-3.5" /> },
        { label: "Transactions", path: `${base}/banking/transactions`, icon: <CreditCard className="h-3.5 w-3.5" /> },
        { label: "Reconciliation", path: `${base}/banking/reconciliation`, icon: <RefreshCw className="h-3.5 w-3.5" /> },
      ],
    },
    {
      title: "Reports",
      icon: <BarChart3 className="h-4 w-4" />,
      matchSegment: "reports",
      items: [
        { label: "Profit & Loss", path: `${base}/reports/profit-loss`, icon: <TrendingUp className="h-3.5 w-3.5" /> },
        { label: "Balance Sheet", path: `${base}/reports/balance-sheet`, icon: <Scale className="h-3.5 w-3.5" /> },
        { label: "Cash Flow", path: `${base}/reports/cash-flow`, icon: <Wallet className="h-3.5 w-3.5" /> },
        { label: "Trial Balance", path: `${base}/reports/trial-balance`, icon: <BarChart3 className="h-3.5 w-3.5" /> },
        { label: "General Ledger", path: `${base}/reports/general-ledger`, icon: <BookOpen className="h-3.5 w-3.5" /> },
      ],
    },
  ];
}

type SidebarNavProps = {
  companySlug: string;
  onNavigate: (path: string) => void;
};

export function SidebarNav({ companySlug, onNavigate }: SidebarNavProps) {
  const pathname = usePathname();
  const navGroups = buildNav(companySlug);
  const dashboardPath = `/app/c/${companySlug}/dashboard`;

  // Determine which group is active from the URL
  const activeSegment = pathname.split("/")[5] ?? "";

  // Track which groups are expanded — default open the active one
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const group of navGroups) {
      initial[group.matchSegment] = group.matchSegment === activeSegment;
    }
    return initial;
  });

  function toggle(segment: string) {
    setExpanded((prev) => ({ ...prev, [segment]: !prev[segment] }));
  }

  const isDashboardActive = pathname === dashboardPath;

  return (
    <nav className="flex flex-col gap-1 px-3 py-2 sidebar-scroll overflow-y-auto flex-1">
      {/* Dashboard */}
      <button
        onClick={() => onNavigate(dashboardPath)}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          isDashboardActive
            ? "bg-sidebar-primary text-sidebar-primary-foreground"
            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )}
      >
        <LayoutDashboard className="h-4 w-4 shrink-0" />
        Dashboard
      </button>

      <div className="my-2 border-t border-sidebar-border" />

      {/* Groups */}
      {navGroups.map((group) => {
        const isGroupActive = activeSegment === group.matchSegment;
        const isOpen = expanded[group.matchSegment] ?? false;
        const hasActiveChild = group.items.some((item) => pathname === item.path || pathname.startsWith(item.path + "/"));

        return (
          <div key={group.matchSegment}>
            {/* Group header */}
            <button
              onClick={() => toggle(group.matchSegment)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isGroupActive || hasActiveChild
                  ? "text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground",
                "hover:bg-sidebar-accent"
              )}
            >
              <span className="shrink-0">{group.icon}</span>
              <span className="flex-1 text-left">{group.title}</span>
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 shrink-0 text-sidebar-foreground/40 transition-transform duration-200",
                  isOpen && "rotate-180"
                )}
              />
            </button>

            {/* Group items */}
            {isOpen && (
              <div className="ml-3 mt-0.5 flex flex-col gap-0.5 border-l border-sidebar-border pl-3">
                {group.items.map((item) => {
                  const isActive = pathname === item.path || pathname.startsWith(item.path + "/");
                  return (
                    <button
                      key={item.path}
                      onClick={() => onNavigate(item.path)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                        isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground"
                          : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <span className="shrink-0">{item.icon}</span>
                      {item.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
