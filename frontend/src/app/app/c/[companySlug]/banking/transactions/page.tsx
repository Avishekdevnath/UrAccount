"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { ApiError, fetchBankTransactions, matchBankTransaction } from "@/lib/api-client";
import type { BankTransaction } from "@/lib/api-types";
import { useCompanyContext } from "@/lib/use-company-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function fmt(value: string | null | undefined): string {
  if (!value) return "—";
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
}

export default function BankingTransactionsPage() {
  const params = useParams<{ companySlug: string }>();
  const companySlug = params.companySlug;
  const { isLoading, error, user, companies, activeCompany, access, handleNavigate, handleLogout } =
    useCompanyContext(companySlug);

  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [matchJournalId, setMatchJournalId] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState("");

  const canPost = !!access?.permissions.includes("accounting.post");

  const loadTransactions = useCallback(async (companyId: string, status: string) => {
    setLoadingTransactions(true);
    try {
      const data = await fetchBankTransactions(companyId, {
        status: status === "all" ? undefined : status,
      });
      setTransactions(data);
    } finally {
      setLoadingTransactions(false);
    }
  }, []);

  useEffect(() => {
    if (!activeCompany) return;
    void loadTransactions(activeCompany.id, statusFilter);
  }, [activeCompany, loadTransactions, statusFilter]);

  async function handleRefresh(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeCompany) return;
    await loadTransactions(activeCompany.id, statusFilter);
  }

  async function handleMatch(transactionId: string) {
    if (!activeCompany || !canPost) return;
    setActionError("");
    const journalId = (matchJournalId[transactionId] || "").trim();
    if (!journalId) {
      setActionError("Provide a journal entry ID before matching.");
      return;
    }
    try {
      await matchBankTransaction(activeCompany.id, transactionId, journalId);
      await loadTransactions(activeCompany.id, statusFilter);
    } catch (err) {
      if (err instanceof ApiError) {
        setActionError(`Match failed (${err.status}).`);
      } else {
        setActionError("Match failed.");
      }
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
        title="Bank Transactions"
        description="Review imported transactions and manually match posted journals."
        breadcrumbs={[{ label: "Banking" }, { label: "Transactions" }]}
        actions={
          <form onSubmit={handleRefresh} className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 w-32 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="imported">Imported</SelectItem>
                <SelectItem value="matched">Matched</SelectItem>
                <SelectItem value="reconciled">Reconciled</SelectItem>
                <SelectItem value="ignored">Ignored</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit" size="sm" variant="outline">
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
            </Button>
          </form>
        }
      />

      {actionError && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {actionError}
        </div>
      )}

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="font-semibold text-xs">Date</TableHead>
              <TableHead className="font-semibold text-xs">Description</TableHead>
              <TableHead className="font-semibold text-xs text-right">Amount</TableHead>
              <TableHead className="font-semibold text-xs">Status</TableHead>
              <TableHead className="font-semibold text-xs">Matched Entry</TableHead>
              {canPost && <TableHead className="font-semibold text-xs w-56">Match Action</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingTransactions ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center">
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                  </div>
                </TableCell>
              </TableRow>
            ) : transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center">
                  <p className="text-sm text-muted-foreground">No transactions found.</p>
                </TableCell>
              </TableRow>
            ) : (
              transactions.map((txn) => (
                <TableRow key={txn.id}>
                  <TableCell className="text-sm text-muted-foreground">{txn.txn_date}</TableCell>
                  <TableCell className="text-sm">{txn.description || "—"}</TableCell>
                  <TableCell className="text-sm text-right tabular-nums font-medium">{fmt(txn.amount)}</TableCell>
                  <TableCell><StatusBadge status={txn.status} /></TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">{txn.matched_entry_no ?? "—"}</TableCell>
                  {canPost && (
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Input
                          className="h-7 text-xs font-mono w-28"
                          placeholder="Journal UUID"
                          value={matchJournalId[txn.id] || ""}
                          onChange={(e) =>
                            setMatchJournalId((prev) => ({ ...prev, [txn.id]: e.target.value }))
                          }
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          disabled={!canPost || txn.status === "reconciled"}
                          onClick={() => void handleMatch(txn.id)}
                        >
                          Match
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </AppShell>
  );
}
