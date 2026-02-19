"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { ApiError, fetchCompanies, login } from "@/lib/api-client";
import { setTokens } from "@/lib/auth-storage";
import { getFirstCompanyDashboardPath } from "@/lib/company-routing";

const DEMO_PASSWORD = "Demo@12345";
const DEMO_USERS = [
  { role: "Owner", email: "owner@demo.local" },
  { role: "Admin", email: "admin@demo.local" },
  { role: "Accountant", email: "accountant@demo.local" },
  { role: "Viewer", email: "viewer@demo.local" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("owner@demo.local");
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const tokens = await login(email, password);
      setTokens(tokens.access, tokens.refresh);
      const companies = await fetchCompanies();
      const nextPath = getFirstCompanyDashboardPath(companies) ?? "/app";
      router.replace(nextPath);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setErrorMessage("Invalid email or password.");
      } else {
        setErrorMessage("Unable to login. Check backend status and try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-4">
      <section className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-zinc-900">URAccount Login</h1>
        <p className="mt-1 text-sm text-zinc-600">Demo password for all users: {DEMO_PASSWORD}</p>

        <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 p-3">
          <p className="text-xs font-medium text-zinc-700">Demo users</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {DEMO_USERS.map((user) => (
              <button
                key={user.email}
                type="button"
                onClick={() => {
                  setEmail(user.email);
                  setPassword(DEMO_PASSWORD);
                }}
                className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs text-zinc-700 hover:bg-zinc-100"
              >
                {user.role}
              </button>
            ))}
          </div>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-800" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-800" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
              autoComplete="current-password"
              required
            />
          </div>

          {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}
