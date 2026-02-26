"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Loader2 } from "lucide-react";

import { ApiError, fetchCompanies, fetchMe, login } from "@/lib/api-client";
import { setTokens } from "@/lib/auth-storage";
import { getFirstCompanyDashboardPath } from "@/lib/company-routing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const DEMO_PASSWORD = "Demo@12345";
const SHOW_SYSTEM_ADMIN_DEMO = process.env.NEXT_PUBLIC_SHOW_SYSTEM_ADMIN_DEMO === "1";
const SHOW_SYSTEM_ADMIN_UI = process.env.NEXT_PUBLIC_SYSTEM_ADMIN_UI === "1";

const BASE_DEMO_USERS = [
  { role: "Owner", email: "owner@demo.local" },
  { role: "Admin", email: "admin@demo.local" },
  { role: "Accountant", email: "accountant@demo.local" },
  { role: "Viewer", email: "viewer@demo.local" },
];

const DEMO_USERS = SHOW_SYSTEM_ADMIN_DEMO && SHOW_SYSTEM_ADMIN_UI
  ? [...BASE_DEMO_USERS, { role: "System Admin", email: "sysadmin@demo.local" }]
  : BASE_DEMO_USERS;

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
      const [me, companies] = await Promise.all([fetchMe(), fetchCompanies()]);
      if (SHOW_SYSTEM_ADMIN_UI && me.system_role && me.system_role_active) {
        router.replace("/system");
        return;
      }
      const nextPath = getFirstCompanyDashboardPath(companies) ?? "/app";
      router.replace(nextPath);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setErrorMessage("Invalid email or password. Please try again.");
      } else {
        setErrorMessage("Unable to connect. Check that the backend is running.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Left panel — brand */}
      <div
        className="hidden lg:flex lg:w-[420px] flex-col justify-between p-10 shrink-0"
        style={{ background: "var(--sidebar)" }}
      >
        <Link href="/" className="inline-flex items-center gap-2.5 no-underline hover:no-underline">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Building2 className="h-4 w-4 text-primary-foreground" />
          </div>
          <span
            className="text-lg font-semibold tracking-tight"
            style={{ color: "var(--sidebar-foreground)" }}
          >
            UrAccount
          </span>
        </Link>

        <div>
          <blockquote
            className="text-sm leading-relaxed"
            style={{ color: "var(--sidebar-foreground)", opacity: 0.7 }}
          >
            &ldquo;UrAccount gives our finance team the clarity we need — real-time P&amp;L,
            automated reconciliation, and multi-entity support all in one place.&rdquo;
          </blockquote>
          <p className="mt-4 text-xs" style={{ color: "var(--sidebar-foreground)", opacity: 0.4 }}>
            — Demo Company, Finance Team
          </p>
        </div>

        <p className="text-xs" style={{ color: "var(--sidebar-foreground)", opacity: 0.4 }}>
          © {new Date().getFullYear()} UrAccount. Professional accounting software.
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 flex-col items-center justify-center bg-background px-6 py-12">
        {/* Mobile logo */}
        <Link href="/" className="mb-8 inline-flex items-center gap-2 no-underline hover:no-underline lg:hidden">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Building2 className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold tracking-tight">UrAccount</span>
        </Link>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Sign in</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Enter your credentials to access your account.
            </p>
          </div>

          {/* Demo user pills */}
          <div className="mb-6 rounded-lg border border-border bg-muted/40 p-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Demo accounts — click to fill:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {DEMO_USERS.map((user) => (
                <button
                  key={user.email}
                  type="button"
                  onClick={() => {
                    setEmail(user.email);
                    setPassword(DEMO_PASSWORD);
                  }}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    email === user.email
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-foreground hover:bg-accent"
                  )}
                >
                  {user.role}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Password:{" "}
              <span className="font-mono font-medium text-foreground">{DEMO_PASSWORD}</span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
                placeholder="you@company.com"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
                placeholder="••••••••"
              />
            </div>

            {errorMessage && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
                <p className="text-sm text-destructive">{errorMessage}</p>
              </div>
            )}

            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
