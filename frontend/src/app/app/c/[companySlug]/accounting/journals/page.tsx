"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, MoreHorizontal, Plus } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import {
  ApiError,
  createJournal,
  fetchAccounts,
  fetchJournals,
  postJournal,
  replaceJournalLines,
  voidJournal,
} from "@/lib/api-client";
import type { Account, JournalEntry } from "@/lib/api-types";
import { useCompanyContext } from "@/lib/use-company-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { cn } from "@/lib/utils";

export default function JournalsPage() {
  const params = useParams<{ companySlug: string }>();
  const companySlug = params.companySlug;
  const { isLoading, error, user, companies, activeCompany, access, handleNavigate, handleLogout } =
    useCompanyContext(companySlug);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    entry_date: new Date().toISOString().slice(0, 10),
    description: "",
    debit_account_id: "",
    credit_account_id: "",
    amount: "100.00",
    post_now: true,
  });

  const canPost = !!access?.permissions.includes("accounting.post");

  async function loadData(companyId: string) {
    setLoadingData(true);
    try {
      const [acct, je] = await Promise.all([fetchAccounts(companyId), fetchJournals(companyId)]);
      setAccounts(acct);
      setJournals(je);
      setForm((prev) => ({
        ...prev,
        debit_account_id: prev.debit_account_id || acct[0]?.id || "",
        credit_account_id: prev.credit_account_id || acct[1]?.id || acct[0]?.id || "",
      }));
    } finally {
      setLoadingData(false);
    }
  }

  useEffect(() => {
    if (!activeCompany) return;
    void loadData(activeCompany.id);
  }, [activeCompany]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeCompany || !canPost) return;
    setFormError("");
    setSubmitting(true);
    try {
      const draft = await createJournal(activeCompany.id, {
        entry_date: form.entry_date,
        description: form.description || "Manual Journal",
      });
      await replaceJournalLines(activeCompany.id, draft.id, [
        { account_id: form.debit_account_id, debit: form.amount, credit: "0.00", description: "Debit line" },
        { account_id: form.credit_account_id, debit: "0.00", credit: form.amount, description: "Credit line" },
      ]);
      if (form.post_now) await postJournal(activeCompany.id, draft.id);
      setDialogOpen(false);
      await loadData(activeCompany.id);
    } catch (err) {
      setFormError(err instanceof ApiError ? `Create failed (${err.status}).` : "Create failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePost(journalId: string) {
    if (!activeCompany || !canPost) return;
    setActionError("");
    try {
      await postJournal(activeCompany.id, journalId);
      await loadData(activeCompany.id);
    } catch (err) {
      setActionError(err instanceof ApiError ? `Post failed (${err.status}).` : "Post failed.");
    }
  }

  async function handleVoid(journalId: string) {
    if (!activeCompany || !canPost) return;
    setActionError("");
    try {
      await voidJournal(activeCompany.id, journalId);
      await loadData(activeCompany.id);
    } catch (err) {
      setActionError(err instanceof ApiError ? `Void failed (${err.status}).` : "Void failed.");
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
        title="Journals"
        description="Create journal entries, post drafts, and void posted entries."
        breadcrumbs={[{ label: "Accounting" }, { label: "Journals" }]}
        actions={
          <Button size="sm" onClick={() => setDialogOpen(true)} disabled={!canPost}>
            <Plus className="mr-1.5 h-4 w-4" /> New Journal
          </Button>
        }
      />

      {actionError && (
        <div className="mb-4 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
          <p className="text-sm text-destructive">{actionError}</p>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-28 font-semibold text-xs">Entry #</TableHead>
              <TableHead className="font-semibold text-xs">Date</TableHead>
              <TableHead className="font-semibold text-xs">Description</TableHead>
              <TableHead className="font-semibold text-xs">Status</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingData ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center">
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading journals…
                  </div>
                </TableCell>
              </TableRow>
            ) : journals.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center">
                  <p className="text-sm text-muted-foreground">No journal entries yet.</p>
                  {canPost && (
                    <button onClick={() => setDialogOpen(true)} className="mt-2 text-sm text-primary hover:underline">
                      Create your first entry
                    </button>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              journals.map((journal) => (
                <TableRow key={journal.id}>
                  <TableCell className="font-medium text-sm">{journal.entry_no ? `#${journal.entry_no}` : "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{journal.entry_date}</TableCell>
                  <TableCell className="text-sm">{journal.description || "—"}</TableCell>
                  <TableCell><StatusBadge status={journal.status} /></TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem disabled={!canPost || journal.status !== "draft"} onClick={() => handlePost(journal.id)}>
                          Post entry
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          disabled={!canPost || journal.status !== "posted"}
                          onClick={() => handleVoid(journal.id)}
                          className={cn(canPost && journal.status === "posted" ? "text-destructive focus:text-destructive" : "")}
                        >
                          Void entry
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New Journal Entry</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Entry Date</Label>
                <Input type="date" value={form.entry_date} onChange={(e) => setForm((p) => ({ ...p, entry_date: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label>Amount</Label>
                <Input value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} placeholder="0.00" required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Manual Journal" />
            </div>
            <div className="space-y-1.5">
              <Label>Debit Account</Label>
              <Select value={form.debit_account_id} onValueChange={(v) => setForm((p) => ({ ...p, debit_account_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>{accounts.map((a) => (<SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Credit Account</Label>
              <Select value={form.credit_account_id} onValueChange={(v) => setForm((p) => ({ ...p, credit_account_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>{accounts.map((a) => (<SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.post_now} onChange={(e) => setForm((p) => ({ ...p, post_now: e.target.checked }))} className="rounded border-border" />
                <span className="font-medium">Post immediately after creation</span>
              </label>
            </div>
            {formError && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
                <p className="text-sm text-destructive">{formError}</p>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting || !form.debit_account_id || !form.credit_account_id}>
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating…</> : "Create Entry"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
