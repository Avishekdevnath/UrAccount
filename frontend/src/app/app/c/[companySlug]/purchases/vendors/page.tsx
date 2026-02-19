"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, MoreHorizontal, Plus, Search } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { ApiError, createContact, deleteContact, fetchContacts } from "@/lib/api-client";
import type { Contact } from "@/lib/api-types";
import { useCompanyContext } from "@/lib/use-company-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function VendorsPage() {
  const params = useParams<{ companySlug: string }>();
  const companySlug = params.companySlug;
  const { isLoading, error, user, companies, activeCompany, access, handleNavigate, handleLogout } =
    useCompanyContext(companySlug);

  const [vendors, setVendors] = useState<Contact[]>([]);
  const [loadingVendors, setLoadingVendors] = useState(false);
  const [search, setSearch] = useState("");
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });

  const canPost = !!access?.permissions.includes("accounting.post");

  async function loadVendors(companyId: string, searchValue = "") {
    setLoadingVendors(true);
    try {
      const data = await fetchContacts(companyId, { type: "vendor", search: searchValue || undefined });
      setVendors(data);
    } finally {
      setLoadingVendors(false);
    }
  }

  useEffect(() => {
    if (!activeCompany) return;
    void loadVendors(activeCompany.id);
  }, [activeCompany]);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeCompany) return;
    await loadVendors(activeCompany.id, search);
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeCompany || !canPost) return;
    setFormError("");
    setSubmitting(true);
    try {
      await createContact(activeCompany.id, {
        type: "vendor",
        name: form.name,
        email: form.email || undefined,
        phone: form.phone || undefined,
        is_active: true,
      });
      setForm({ name: "", email: "", phone: "" });
      setDialogOpen(false);
      await loadVendors(activeCompany.id, search);
    } catch (err) {
      setFormError(err instanceof ApiError ? `Create failed (${err.status}).` : "Create failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(vendorId: string) {
    if (!activeCompany || !canPost) return;
    if (!window.confirm("Delete this vendor? This cannot be undone.")) return;
    setActionError("");
    try {
      await deleteContact(activeCompany.id, vendorId);
      await loadVendors(activeCompany.id, search);
    } catch (err) {
      setActionError(
        err instanceof ApiError
          ? (err.payload as { detail?: string })?.detail || `Delete failed (${err.status}).`
          : "Delete failed."
      );
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
        title="Vendors"
        description="Manage your vendor contacts."
        breadcrumbs={[{ label: "Purchases" }, { label: "Vendors" }]}
        actions={
          <Button size="sm" onClick={() => setDialogOpen(true)} disabled={!canPost}>
            <Plus className="mr-1.5 h-4 w-4" /> New Vendor
          </Button>
        }
      />

      <form onSubmit={handleSearch} className="mb-4 flex items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-8 pl-8 w-56 text-sm"
            placeholder="Search vendors…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button type="submit" size="sm" variant="outline">Search</Button>
        <span className="text-sm text-muted-foreground">
          {loadingVendors ? "Loading…" : `${vendors.length} vendor${vendors.length !== 1 ? "s" : ""}`}
        </span>
      </form>

      {actionError && (
        <div className="mb-4 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
          <p className="text-sm text-destructive">{actionError}</p>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="font-semibold text-xs">Name</TableHead>
              <TableHead className="font-semibold text-xs">Email</TableHead>
              <TableHead className="font-semibold text-xs">Phone</TableHead>
              <TableHead className="font-semibold text-xs">Status</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingVendors ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center">
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading vendors…
                  </div>
                </TableCell>
              </TableRow>
            ) : vendors.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center">
                  <p className="text-sm text-muted-foreground">No vendors found.</p>
                  {canPost && (
                    <button onClick={() => setDialogOpen(true)} className="mt-2 text-sm text-primary hover:underline">
                      Add your first vendor
                    </button>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              vendors.map((vendor) => (
                <TableRow key={vendor.id}>
                  <TableCell className="text-sm font-medium">{vendor.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{vendor.email || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{vendor.phone || "—"}</TableCell>
                  <TableCell><StatusBadge status={vendor.is_active ? "active" : "inactive"} /></TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          disabled={!canPost}
                          className="text-destructive focus:text-destructive"
                          onClick={() => void handleDelete(vendor.id)}
                        >
                          Delete
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
          <DialogHeader><DialogTitle>New Vendor</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Name <span className="text-destructive">*</span></Label>
              <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Vendor name" required />
            </div>
            <div className="space-y-1.5">
              <Label>Email <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder="accounts@vendor.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Phone <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} placeholder="+1 555 000 0000" />
            </div>
            {formError && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
                <p className="text-sm text-destructive">{formError}</p>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting || !form.name}>
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating…</> : "Create Vendor"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
