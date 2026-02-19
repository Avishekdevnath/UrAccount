import { cn } from "@/lib/utils";

type StatusVariant =
  | "draft"
  | "posted"
  | "paid"
  | "partially_paid"
  | "void"
  | "uploaded"
  | "parsed"
  | "failed"
  | "imported"
  | "matched"
  | "reconciled"
  | "ignored"
  | "finalized"
  | "active"
  | "inactive";

const variantMap: Record<StatusVariant, { label: string; className: string }> = {
  draft:         { label: "Draft",          className: "bg-amber-50 text-amber-700 ring-amber-200" },
  posted:        { label: "Posted",         className: "bg-blue-50 text-blue-700 ring-blue-200" },
  paid:          { label: "Paid",           className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  partially_paid:{ label: "Partial",        className: "bg-orange-50 text-orange-700 ring-orange-200" },
  void:          { label: "Void",           className: "bg-slate-100 text-slate-500 ring-slate-200" },
  uploaded:      { label: "Uploaded",       className: "bg-blue-50 text-blue-700 ring-blue-200" },
  parsed:        { label: "Parsed",         className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  failed:        { label: "Failed",         className: "bg-red-50 text-red-700 ring-red-200" },
  imported:      { label: "Imported",       className: "bg-blue-50 text-blue-600 ring-blue-200" },
  matched:       { label: "Matched",        className: "bg-violet-50 text-violet-700 ring-violet-200" },
  reconciled:    { label: "Reconciled",     className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  ignored:       { label: "Ignored",        className: "bg-slate-100 text-slate-500 ring-slate-200" },
  finalized:     { label: "Finalized",      className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  active:        { label: "Active",         className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  inactive:      { label: "Inactive",       className: "bg-slate-100 text-slate-500 ring-slate-200" },
};

type StatusBadgeProps = {
  status: string;
  className?: string;
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const variant = variantMap[status as StatusVariant];
  if (!variant) {
    return (
      <span className={cn("inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ring-1 ring-inset bg-slate-100 text-slate-600 ring-slate-200", className)}>
        {status}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        variant.className,
        className
      )}
    >
      {variant.label}
    </span>
  );
}
