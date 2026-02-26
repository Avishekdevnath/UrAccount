"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { ApiError, fetchMe } from "@/lib/api-client";
import { clearTokens, getAccessToken } from "@/lib/auth-storage";
import type { UserMe } from "@/lib/api-types";

type SystemContextState = {
  isLoading: boolean;
  error: string;
  user: UserMe | null;
};

export function useSystemContext() {
  const router = useRouter();
  const [state, setState] = useState<SystemContextState>({
    isLoading: true,
    error: "",
    user: null,
  });

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }

    async function loadContext() {
      try {
        const user = await fetchMe();
        if (!user.system_role || !user.system_role_active) {
          setState({ isLoading: false, error: "Access denied. System admin role required.", user: null });
          return;
        }
        setState({ isLoading: false, error: "", user });
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          clearTokens();
          router.replace("/login");
          return;
        }
        setState({ isLoading: false, error: "Could not load session.", user: null });
      }
    }

    void loadContext();
  }, [router]);

  function handleLogout() {
    clearTokens();
    router.replace("/login");
  }

  function handleNavigate(path: string) {
    router.push(path);
  }

  return { ...state, handleLogout, handleNavigate };
}
