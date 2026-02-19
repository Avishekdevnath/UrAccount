"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { fetchCompanies } from "@/lib/api-client";
import { getAccessToken } from "@/lib/auth-storage";
import { clearTokens } from "@/lib/auth-storage";
import { getFirstCompanyDashboardPath } from "@/lib/company-routing";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }

    async function routeToCompany() {
      try {
        const companies = await fetchCompanies();
        const nextPath = getFirstCompanyDashboardPath(companies) ?? "/app";
        router.replace(nextPath);
      } catch {
        clearTokens();
        router.replace("/login");
      }
    }

    void routeToCompany();
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-zinc-600">Redirecting...</p>
    </main>
  );
}
