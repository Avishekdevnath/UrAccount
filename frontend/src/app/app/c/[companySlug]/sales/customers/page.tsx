"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { ApiError, createContact, deleteContact, fetchContacts } from "@/lib/api-client";
import type { Contact } from "@/lib/api-types";
import { useCompanyContext } from "@/lib/use-company-context";

export default function CustomersPage() {
  const params = useParams<{ companySlug: string }>();
  const companySlug = params.companySlug;
  const { isLoading, error, user, companies, activeCompany, access, handleNavigate, handleLogout } =
    useCompanyContext(companySlug);

  const [customers, setCustomers] = useState<Contact[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [search, setSearch] = useState("");
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
  });

  const canPost = !!access?.permissions.includes("accounting.post");

  async function loadCustomers(companyId: string, searchValue = "") {
    setLoadingCustomers(true);
    try {
      const data = await fetchContacts(companyId, { type: "customer", search: searchValue || undefined });
      setCustomers(data);
    } finally {
      setLoadingCustomers(false);
    }
  }

  useEffect(() => {
    if (!activeCompany) {
      return;
    }
    void loadCustomers(activeCompany.id);
  }, [activeCompany]);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeCompany) {
      return;
    }
    await loadCustomers(activeCompany.id, search);
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeCompany || !canPost) {
      return;
    }
    setFormError("");
    try {
      await createContact(activeCompany.id, {
        type: "customer",
        name: form.name,
        email: form.email || undefined,
        phone: form.phone || undefined,
        is_active: true,
      });
      setForm({ name: "", email: "", phone: "" });
      await loadCustomers(activeCompany.id, search);
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(`Create failed (${err.status}).`);
      } else {
        setFormError("Create failed.");
      }
    }
  }

  async function handleDelete(customerId: string) {
    if (!activeCompany || !canPost) {
      return;
    }
    if (!window.confirm("Delete this customer contact?")) {
      return;
    }
    setActionError("");
    try {
      await deleteContact(activeCompany.id, customerId);
      await loadCustomers(activeCompany.id, search);
    } catch (err) {
      if (err instanceof ApiError) {
        setActionError((err.payload as { detail?: string })?.detail || `Delete failed (${err.status}).`);
      } else {
        setActionError("Delete failed.");
      }
    }
  }

  if (isLoading) {
    return <main className="flex min-h-screen items-center justify-center text-sm text-zinc-600">Loading...</main>;
  }

  if (error || !user || !activeCompany || !access) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <section className="w-full max-w-md rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          <p>{error || "Access context is missing."}</p>
          <button className="mt-3 text-sm underline" onClick={handleLogout}>
            Go to login
          </button>
        </section>
      </main>
    );
  }

  return (
    <AppShell
      user={user}
      companies={companies}
      activeCompany={activeCompany}
      access={access}
      onLogout={handleLogout}
      onNavigate={handleNavigate}
    >
      <div className="rounded-lg border border-zinc-200 p-4">
        <h2 className="text-lg font-medium text-zinc-900">Customers</h2>
        <p className="mt-1 text-sm text-zinc-600">Create and search customer contacts.</p>

        <form className="mt-4 flex flex-wrap items-end gap-2" onSubmit={handleSearch}>
          <div>
            <label className="mb-1 block text-xs text-zinc-600" htmlFor="search-customers">
              Search
            </label>
            <input
              id="search-customers"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
              placeholder="Customer name"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <button className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50">
            Search
          </button>
        </form>

        <form className="mt-4 grid gap-3 md:grid-cols-4" onSubmit={handleCreate}>
          <input
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            placeholder="Customer name"
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            required
          />
          <input
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            placeholder="Email"
            value={form.email}
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
          />
          <input
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            placeholder="Phone"
            value={form.phone}
            onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
          />
          <button
            type="submit"
            disabled={!canPost}
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-45"
          >
            Create Customer
          </button>
        </form>
        {formError ? <p className="mt-2 text-sm text-red-600">{formError}</p> : null}
        {actionError ? <p className="mt-2 text-sm text-red-600">{actionError}</p> : null}

        <div className="mt-6 overflow-x-auto">
          {loadingCustomers ? (
            <p className="text-sm text-zinc-600">Loading customers...</p>
          ) : (
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-600">
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Email</th>
                  <th className="py-2 pr-3">Phone</th>
                  <th className="py-2 pr-3">Active</th>
                  <th className="py-2 pr-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id} className="border-b border-zinc-100">
                    <td className="py-2 pr-3">{customer.name}</td>
                    <td className="py-2 pr-3">{customer.email || "-"}</td>
                    <td className="py-2 pr-3">{customer.phone || "-"}</td>
                    <td className="py-2 pr-3">{customer.is_active ? "Yes" : "No"}</td>
                    <td className="py-2 pr-3">
                      <button
                        type="button"
                        disabled={!canPost}
                        onClick={() => void handleDelete(customer.id)}
                        className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppShell>
  );
}
