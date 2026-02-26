import { PublicSection } from "@/modules/public/components/shared/public-section";
import { PublicSectionHead } from "@/modules/public/components/shared/public-section-head";

const comparisonRows = [
  {
    criteria: "Period close cycle",
    uraccount: "Structured close with traceability and posting controls",
    legacy: "Spreadsheet consolidation and manual checks",
  },
  {
    criteria: "Reconciliation effort",
    uraccount: "Import and matching workflows with exception visibility",
    legacy: "Manual matching with fragmented data sources",
  },
  {
    criteria: "Audit readiness",
    uraccount: "Built-in action history and report consistency",
    legacy: "Evidence collection after-the-fact",
  },
  {
    criteria: "Operational visibility",
    uraccount: "Live P&L, balance sheet, cash flow, AR/AP aging",
    legacy: "Delayed reports and ad-hoc spreadsheets",
  },
];

export function ComparisonSection() {
  return (
    <PublicSection background="alt">
      <PublicSectionHead
        align="center"
        label="Why Teams Switch"
        title="UrAccount vs manual accounting workflows"
        subtitle="Replace brittle spreadsheet operations with a system designed for accounting integrity."
      />

      <div className="overflow-hidden rounded-xl border border-[var(--public-border)] bg-white shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
        <table className="w-full border-collapse text-left">
          <thead className="bg-[var(--public-surface-alt)]">
            <tr>
              <th className="px-4 py-3 text-sm font-semibold text-[var(--public-text)]">Criteria</th>
              <th className="px-4 py-3 text-sm font-semibold text-[var(--public-primary)]">UrAccount</th>
              <th className="px-4 py-3 text-sm font-semibold text-[var(--public-text-muted)]">Traditional Setup</th>
            </tr>
          </thead>
          <tbody>
            {comparisonRows.map((row) => (
              <tr key={row.criteria} className="border-t border-[var(--public-border)]">
                <td className="px-4 py-3 text-sm font-medium text-[var(--public-text)]">{row.criteria}</td>
                <td className="px-4 py-3 text-sm text-[var(--public-text)]">{row.uraccount}</td>
                <td className="px-4 py-3 text-sm text-[var(--public-text-muted)]">{row.legacy}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PublicSection>
  );
}

