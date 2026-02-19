"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import {
  ApiError,
  fetchBankTransactions,
  fetchReconciliation,
  finalizeReconciliation,
  replaceReconciliationLines,
} from "@/lib/api-client";
import type { BankReconciliation, BankTransaction } from "@/lib/api-types";
import { getCompanyReconciliationsPath } from "@/lib/company-routing";
import { useCompanyContext } from "@/lib/use-company-context";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

function fmt(value: string | null | undefined): string {
  if (!value) return "—";
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
}

export default function ReconciliationDetailPage() {
  const params = useParams<{ companySlug: string; reconciliationId: string }>();
  const companySlug = params.companySlug;
  const reconciliationId = params.reconciliationId;
  const { isLoading, error, user, companies, activeCompany, access, handleNavigate, handleLogout } =
    useCompanyContext(companySlug);

  const [reconciliation, setReconciliation] = useState<BankReconciliation | null>(null);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [actionError, setActionError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  const canPost = !!access?.permissions.includes("accounting.post");
  const canEditDraft = !!(canPost && reconciliation?.status === "draft");

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const loadData = useCallback(async (companyId: string) => {
    setLoadingData(true);
    try {
      const [reconciliationData, transactionData] = await Promise.all([
        fetchReconciliation(companyId, reconciliationId),
        fetchBankTransactions(companyId, { limit: 500 }),
      ]);
      setReconciliation(reconciliationData);
      setTransactions(transactionData);
      const lineIds = reconciliationData.lines?.map((line) => line.bank_transaction_id) || [];
      setSelectedIds(lineIds);
    } finally {
      setLoadingData(false);
    }
  }, [reconciliationId]);

  useEffect(() => {
    if (!activeCompany) return;
    void loadData(activeCompany.id);
  }, [activeCompany, loadData]);

  async function handleSaveLines() {
    if (!activeCompany || !canEditDraft) return;
    setActionError("");
    setInfoMessage("");
    setSaving(true);
    try {
      await replaceReconciliationLines(activeCompany.id, reconciliationId, selectedIds);
      await loadData(activeCompany.id);
      setInfoMessage("Reconciliation lines saved.");
    } catch (err) {
      if (err instanceof ApiError) {
        setActionError(`Save lines failed (${err.status}).`);
      } else {
        setActionError("Save lines failed.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleFinalize() {
    if (!activeCompany || !canEditDraft) return;
    setActionError("");
    setInfoMessage("");
    setFinalizing(true);
    try {
      await finalizeReconciliation(activeCompany.id, reconciliationId);
      await loadData(activeCompany.id);
      setInfoMessage("Reconciliation finalized.");
    } catch (err) {
      if (err instanceof ApiError) {
        setActionError(`Finalize failed (${err.status}).`);
      } else {
        setActionError("Finalize failed.");
      }
    } finally {
      setFinalizing(false);
    }
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      </main>
    );
  }

  if (error || !user || !activeCompany || !access) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <section className="w-full max-w-md rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive">
          <p>{error || "Access context is missing."}</p>
          <button className="mt-3 text-sm underline" onClick={handleLogout}>Go to login</button>
        </section>
      </main>
    );
  }

  return (
    <AppShell user={user} companies={companies} activeCompany={activeCompany} access={access} onLogout={handleLogout} onNavigate={handleNavigate}>
      <PageHeader
        title="Reconciliation Detail"
        description={reconciliation ? `${reconciliation.start_date} — ${reconciliation.end_date}` : "Loading…"}
        breadcrumbs={[{ label: "Banking" }, { label: "Reconciliation" }, { label: "Detail" }]}
        actions={
          <div className="flex items-center gap-2">
            {reconciliation && <StatusBadge status={reconciliation.status} />}
            <Button variant="outline" size="sm" onClick={() => handleNavigate(getCompanyReconciliationsPath(activeCompany.slug))}>
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back
            </Button>
            {canEditDraft && (
              <>
                <Button variant="outline" size="sm" onClick={handleSaveLines} disabled={saving}>
                  {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />} Save Lines
                </Button>
                <Button size="sm" onClick={handleFinalize} disabled={finalizing}>
                  {finalizing ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                  )} Finalize
                </Button>
              </>
            )}
          </div>
        }
      />

      {actionError && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {actionError}
        </div>
      )}
      {infoMessage && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {infoMessage}
        </div>
      )}

      {loadingData ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading reconciliation…
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                {canEditDraft && <TableHead className="w-10 font-semibold text-xs"></TableHead>}
                <TableHead className="font-semibold text-xs">Date</TableHead>
                <TableHead className="font-semibold text-xs">Description</TableHead>
                <TableHead className="font-semibold text-xs text-right">Amount</TableHead>
                <TableHead className="font-semibold text-xs">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center">
                    <p className="text-sm text-muted-foreground">No transactions found.</p>
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((txn) => {
                  const isSelected = selectedSet.has(txn.id);
                  return (
                    <TableRow key={txn.id} className={cn(isSelected && "bg-primary/5")}>
                      {canEditDraft && (
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={!canEditDraft}
                            className="h-4 w-4 rounded border-border accent-primary"
                            onChange={(e) =>
                              setSelectedIds((prev) => {
                                if (e.target.checked) return [...prev, txn.id];
                                return prev.filter((id) => id !== txn.id);
                              })
                            }
                          />
                        </TableCell>
                      )}
                      <TableCell className="text-sm text-muted-foreground">{txn.txn_date}</TableCell>
                      <TableCell className="text-sm">{txn.description || "—"}</TableCell>
                      <TableCell className="text-sm text-right tabular-nums font-medium">{fmt(txn.amount)}</TableCell>
                      <TableCell><StatusBadge status={txn.status} /></TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </AppShell>
  );
}
