import { expect, test } from "@playwright/test";

import { createMockSystemState, installSystemAdminMocks } from "../helpers/system-admin-mocks";

test.describe("System role grant/revoke access behavior", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("uraccount_access_token", "e2e-access-token");
      window.localStorage.setItem("uraccount_refresh_token", "e2e-refresh-token");
    });
  });

  test("revoking role from current operator reflects in UI and blocks /system access", async ({ page }) => {
    const userId = "11111111-1111-1111-1111-111111111111";
    const state = createMockSystemState({
      meUserId: userId,
      meRole: "SUPER_ADMIN",
      usersById: {
        [userId]: {
          id: userId,
          email: "sysadmin@demo.local",
          full_name: "System Admin",
          is_active: true,
          is_staff: true,
          is_superuser: false,
          company_count: 0,
          system_role: "SUPER_ADMIN",
          system_role_active: true,
          created_at: "2026-02-21T00:00:00Z",
          updated_at: "2026-02-21T00:00:00Z",
          memberships: [],
        },
      },
    });
    await installSystemAdminMocks(page, state);

    await page.goto(`/system/users/${userId}`);
    await expect(page.getByTestId("system-role-select")).toHaveValue("SUPER_ADMIN");

    await page.getByTestId("system-role-select").selectOption("");
    await page.getByTestId("system-role-save-button").click();
    await expect(page.getByTestId("system-user-message")).toContainText("Updated successfully.");
    expect(state.roleMutationCalls).toBe(1);
    expect(state.meRole).toBeNull();

    await page.goto("/system");
    await expect(page.getByTestId("system-access-denied")).toContainText("Access denied");
  });
});
