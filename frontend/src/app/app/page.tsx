"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { fetchCompanies } from "@/lib/api-client";
import { clearTokens, getAccessToken } from "@/lib/auth-storage";
import { getFirstCompanyDashboardPath } from "@/lib/company-routing";

export default function AppHomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const access = getAccessToken();
    if (!access) {
      router.replace("/login");
      return;
    }

    async function loadData() {
      try {
        const companyList = await fetchCompanies();
        const nextPath = getFirstCompanyDashboardPath(companyList);
        if (nextPath) {
          router.replace(nextPath);
          return;
        }
        setError("No companies found for this user.");
      } catch {
        setError("Session expired or backend unavailable.");
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, [router]);

  function handleLogout() {
    clearTokens();
    router.replace("/login");
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-zinc-600">Loading dashboard...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <section className="w-full max-w-md rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          <p>{error}</p>
          <button className="mt-3 text-sm underline" onClick={handleLogout}>
            Go to login
          </button>
        </section>
      </main>
    );
  }

  return null;
}
