import type { Page, Route } from "@playwright/test";

type MockSystemRole = "SUPER_ADMIN" | "SUPPORT" | null;

type MockSystemUser = {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  company_count: number;
  system_role: MockSystemRole;
  system_role_active: boolean | null;
  created_at: string;
  updated_at: string;
  memberships?: Array<{
    id: string;
    company_id: string;
    company_slug: string;
    company_name: string;
    company_is_active: boolean;
    status: string;
    joined_at: string;
    created_at: string;
    updated_at: string;
  }>;
};

type MockSystemCompany = {
  id: string;
  name: string;
  slug: string;
  base_currency: string;
  timezone: string;
  fiscal_year_start_month: number;
  is_active: boolean;
  members_count: number;
  created_at: string;
  updated_at: string;
};

export type MockSystemState = {
  meUserId: string;
  meRole: MockSystemRole;
  companies: MockSystemCompany[];
  usersById: Record<string, MockSystemUser>;
  bootstrapCalls: number;
  roleMutationCalls: number;
};

const NOW = "2026-02-21T00:00:00Z";

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

function paginated<T>(results: T[]) {
  return {
    count: results.length,
    next: null,
    previous: null,
    results,
  };
}

export function createMockSystemState(overrides: Partial<MockSystemState> = {}): MockSystemState {
  const baseUserId = "11111111-1111-1111-1111-111111111111";
  const baseUser: MockSystemUser = {
    id: baseUserId,
    email: "sysadmin@demo.local",
    full_name: "System Admin",
    is_active: true,
    is_staff: true,
    is_superuser: false,
    company_count: 0,
    system_role: "SUPER_ADMIN",
    system_role_active: true,
    created_at: NOW,
    updated_at: NOW,
    memberships: [],
  };
  return {
    meUserId: baseUserId,
    meRole: "SUPER_ADMIN",
    companies: [],
    usersById: { [baseUserId]: baseUser },
    bootstrapCalls: 0,
    roleMutationCalls: 0,
    ...overrides,
  };
}

export async function installSystemAdminMocks(page: Page, state: MockSystemState) {
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const path = url.pathname;

    if (path.endsWith("/api/v1/auth/me/") && method === "GET") {
      const me = state.usersById[state.meUserId];
      return json(route, {
        ...me,
        system_role: state.meRole,
        system_role_active: state.meRole ? true : null,
      });
    }

    if (path.endsWith("/api/v1/system/companies/") && method === "GET") {
      return json(route, paginated(state.companies));
    }

    if (path.endsWith("/api/v1/system/companies/bootstrap/") && method === "POST") {
      state.bootstrapCalls += 1;
      const payload = (request.postDataJSON() || {}) as {
        company?: { name?: string; slug?: string };
        owner?: { email?: string };
      };
      const companyId = `company-${state.bootstrapCalls}`;
      const companySlug = payload.company?.slug || `company-${state.bootstrapCalls}`;
      const companyName = payload.company?.name || "Company";
      state.companies.push({
        id: companyId,
        name: companyName,
        slug: companySlug,
        base_currency: "USD",
        timezone: "UTC",
        fiscal_year_start_month: 1,
        is_active: true,
        members_count: 1,
        created_at: NOW,
        updated_at: NOW,
      });
      return json(route, {
        company_id: companyId,
        company_slug: companySlug,
        owner_user_id: state.meUserId,
        owner_email: payload.owner?.email || "owner@test.local",
        owner_created: true,
      });
    }

    const userDetailMatch = path.match(/\/api\/v1\/system\/users\/([0-9a-f-]{36})\/$/i);
    if (userDetailMatch && method === "GET") {
      const userId = userDetailMatch[1];
      const user = state.usersById[userId];
      if (!user) {
        return json(route, { detail: "Not found." }, 404);
      }
      return json(route, user);
    }

    const rolePatchMatch = path.match(/\/api\/v1\/system\/users\/([0-9a-f-]{36})\/system-role\/$/i);
    if (rolePatchMatch && method === "PATCH") {
      state.roleMutationCalls += 1;
      const userId = rolePatchMatch[1];
      const user = state.usersById[userId];
      if (!user) {
        return json(route, { detail: "Not found." }, 404);
      }
      const body = (request.postDataJSON() || {}) as { role?: MockSystemRole; is_active?: boolean };
      user.system_role = Object.prototype.hasOwnProperty.call(body, "role") ? body.role ?? null : user.system_role;
      user.system_role_active =
        user.system_role === null ? null : Object.prototype.hasOwnProperty.call(body, "is_active") ? Boolean(body.is_active) : true;
      user.updated_at = NOW;

      if (userId === state.meUserId) {
        state.meRole = user.system_role;
      }

      return json(route, {
        user_id: user.id,
        user_email: user.email,
        system_role:
          user.system_role === null
            ? null
            : { role: user.system_role, is_active: Boolean(user.system_role_active) },
      });
    }

    if (path.endsWith("/api/v1/system/health/") && method === "GET") {
      return json(route, { status: "ok" });
    }

    if (path.endsWith("/api/v1/system/users/") && method === "GET") {
      return json(route, paginated(Object.values(state.usersById)));
    }

    return json(route, { detail: `No mock for ${method} ${path}` }, 404);
  });
}
