export type FeatureGroup = {
  id: string;
  tabLabel: string;
  title: string;
  subtitle: string;
  items: {
    title: string;
    description: string;
    icon: string;
  }[];
};

export const homeCoreCapabilities = [
  {
    title: "Double-Entry Accounting",
    description:
      "Chart of accounts, journals, and ledgers with strict debit/credit integrity.",
    icon: "BookOpen",
  },
  {
    title: "Invoicing & Receivables",
    description:
      "Issue invoices, track payments, and monitor AR aging with complete visibility.",
    icon: "FileText",
  },
  {
    title: "Purchases & Payables",
    description:
      "Manage vendor bills, due dates, and AP workflows with full traceability.",
    icon: "ReceiptText",
  },
  {
    title: "Bank Reconciliation",
    description:
      "Import, match, and reconcile transactions with clear discrepancy tracking.",
    icon: "Landmark",
  },
  {
    title: "Financial Reporting",
    description:
      "P&L, balance sheet, cash flow, trial balance, and general ledger in real time.",
    icon: "ChartNoAxesCombined",
  },
  {
    title: "Audit Trail",
    description:
      "Every state change and posting action is timestamped and reviewable.",
    icon: "ShieldCheck",
  },
];

export const featureGroups: FeatureGroup[] = [
  {
    id: "accounting",
    tabLabel: "Accounting Core",
    title: "Accounting Core",
    subtitle: "Structured accounting controls with audit-ready ledger behavior.",
    items: [
      {
        title: "Chart of Accounts",
        description: "Hierarchical account structure for assets, liabilities, equity, income, and expense.",
        icon: "Scale",
      },
      {
        title: "Journal Entries",
        description: "Manual and system journals with balancing validation and posting controls.",
        icon: "NotebookPen",
      },
      {
        title: "General Ledger",
        description: "Full ledger view by date range and account filter with export-ready output.",
        icon: "LibraryBig",
      },
      {
        title: "Trial Balance",
        description: "Live debit-credit checks to validate book integrity before close.",
        icon: "ListChecks",
      },
      {
        title: "Period Locking",
        description: "Lock closed periods to prevent backdated edits and maintain consistency.",
        icon: "Lock",
      },
      {
        title: "Multi-Currency",
        description: "Capture foreign currency flows with a consistent base reporting model.",
        icon: "Globe",
      },
    ],
  },
  {
    id: "sales",
    tabLabel: "Sales & Receivables",
    title: "Sales & Receivables",
    subtitle: "Invoice lifecycle tracking from draft to full settlement.",
    items: [
      {
        title: "Invoice Management",
        description: "Create, update, post, and void invoices with line-level control.",
        icon: "FileSpreadsheet",
      },
      {
        title: "Receipt Allocation",
        description: "Allocate customer receipts against open invoices accurately.",
        icon: "HandCoins",
      },
      {
        title: "AR Aging",
        description: "Monitor overdue amounts by aging bucket and customer profile.",
        icon: "ClockAlert",
      },
      {
        title: "Customer Records",
        description: "Maintain customer master data, terms, and account history.",
        icon: "Users",
      },
      {
        title: "Posting Controls",
        description: "Permission-based posting and void actions for financial discipline.",
        icon: "Shield",
      },
      {
        title: "Receivables Visibility",
        description: "See open balances and paid status without spreadsheet reconciliation.",
        icon: "Eye",
      },
    ],
  },
  {
    id: "purchases",
    tabLabel: "Purchases & Payables",
    title: "Purchases & Payables",
    subtitle: "Vendor bill and payment workflow with accountability by default.",
    items: [
      {
        title: "Vendor Bills",
        description: "Record and manage bills with due dates, notes, and account mapping.",
        icon: "FileArchive",
      },
      {
        title: "Bill Line Control",
        description: "Capture expense allocation at bill-line level before posting.",
        icon: "Rows4",
      },
      {
        title: "Vendor Payments",
        description: "Create and post vendor payments with bill allocation detail.",
        icon: "BadgeDollarSign",
      },
      {
        title: "AP Aging",
        description: "Track obligations and prioritize due payments with clean aging output.",
        icon: "Hourglass",
      },
      {
        title: "Vendor Master Data",
        description: "Single source of truth for vendor records and transaction history.",
        icon: "Building2",
      },
      {
        title: "Payment Posting Controls",
        description: "Permission-gated posting actions for payment and bill workflows.",
        icon: "CircleCheckBig",
      },
    ],
  },
  {
    id: "banking",
    tabLabel: "Banking & Reconciliation",
    title: "Banking & Reconciliation",
    subtitle: "Close the loop between bank transactions and ledger records.",
    items: [
      {
        title: "Bank Accounts",
        description: "Link bank accounts to ledger control accounts in a structured setup.",
        icon: "Landmark",
      },
      {
        title: "Statement Imports",
        description: "Import bank statement files and transform them into transaction rows.",
        icon: "Upload",
      },
      {
        title: "Transaction Matching",
        description: "Associate imported entries with journals and reconciliation lines.",
        icon: "Link2",
      },
      {
        title: "Reconciliation Sessions",
        description: "Run reconciliation windows with opening/closing balance controls.",
        icon: "GitCompareArrows",
      },
      {
        title: "Finalize Workflow",
        description: "Finalize reconciliations with clear audit context and line-level trace.",
        icon: "Stamp",
      },
      {
        title: "Exception Visibility",
        description: "Surface unmatched or ambiguous records before period close.",
        icon: "TriangleAlert",
      },
    ],
  },
  {
    id: "reporting",
    tabLabel: "Reporting",
    title: "Reporting",
    subtitle: "Operational and financial reports designed for decision confidence.",
    items: [
      {
        title: "Profit & Loss",
        description: "Track income, expense, and net results by period.",
        icon: "TrendingUp",
      },
      {
        title: "Balance Sheet",
        description: "Review assets, liabilities, and equity as-of any date.",
        icon: "Scale",
      },
      {
        title: "Cash Flow",
        description: "Measure inflow, outflow, and net cash movement.",
        icon: "Wallet",
      },
      {
        title: "General Ledger",
        description: "Analyze line-level ledger entries with filters and limits.",
        icon: "BookText",
      },
      {
        title: "Trial Balance (Reports)",
        description: "Validate total debit and credit balances for selected periods.",
        icon: "Equal",
      },
      {
        title: "Print / PDF Ready",
        description: "Generate clean printable outputs for documents and reports.",
        icon: "Printer",
      },
    ],
  },
];

