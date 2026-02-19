"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { ApiError } from "@/lib/api-client";
import { clearTokens, getAccessToken } from "@/lib/auth-storage";
import { getFirstCompanyDashboardPath } from "@/lib/company-routing";
import type { Company, CompanyAccess, UserMe } from "@/lib/api-types";
import { loadCompanyAccess, loadSessionSnapshot } from "@/lib/session-loader";

type State = {
  isLoading: boolean;
  error: string;
  user: UserMe | null;
  companies: Company[];
  activeCompany: Company | null;
  access: CompanyAccess | null;
};

export function useCompanyContext(companySlug: string) {
  const router = useRouter();
  const [state, setState] = useState<State>({
    isLoading: true,
    error: "",
    user: null,
    companies: [],
    activeCompany: null,
    access: null,
  });

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }

    async function loadContext() {
      try {
        const snapshot = await loadSessionSnapshot();
        const targetCompany = snapshot.companies.find((company) => company.slug === companySlug);

        if (!targetCompany) {
          const fallbackPath = getFirstCompanyDashboardPath(snapshot.companies);
          if (fallbackPath) {
            router.replace(fallbackPath);
            return;
          }
          setState({
            isLoading: false,
            error: "No company context available.",
            user: snapshot.user,
            companies: snapshot.companies,
            activeCompany: null,
            access: null,
          });
          return;
        }

        const access = await loadCompanyAccess(targetCompany.id);
        setState({
          isLoading: false,
          error: "",
          user: snapshot.user,
          companies: snapshot.companies,
          activeCompany: targetCompany,
          access,
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          clearTokens();
          router.replace("/login");
          return;
        }
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: "Could not load company context.",
        }));
      }
    }

    void loadContext();
  }, [companySlug, router]);

  function handleLogout() {
    clearTokens();
    router.replace("/login");
  }

  function handleNavigate(path: string) {
    router.push(path);
  }

  return {
    ...state,
    handleLogout,
    handleNavigate,
  };
}
