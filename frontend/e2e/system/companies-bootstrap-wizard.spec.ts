import { expect, test } from "@playwright/test";

import { createMockSystemState, installSystemAdminMocks } from "../helpers/system-admin-mocks";

test.describe("System company bootstrap wizard", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("uraccount_access_token", "e2e-access-token");
      window.localStorage.setItem("uraccount_refresh_token", "e2e-refresh-token");
    });
  });

  test("creates a company and redirects to companies list", async ({ page }) => {
    const state = createMockSystemState();
    await installSystemAdminMocks(page, state);

    await page.goto("/system/companies/new");

    await page.getByTestId("company-name-input").fill("Acme Ledger");
    await page.getByTestId("company-slug-input").fill("acme-ledger");
    await page.getByTestId("owner-email-input").fill("owner@acme.local");
    await page.getByTestId("owner-full-name-input").fill("Acme Owner");
    await page.getByTestId("owner-password-input").fill("SecurePass@123");
    await page.getByTestId("company-bootstrap-submit").click();

    await expect(page).toHaveURL(/\/system\/companies$/);
    await expect(page.getByText("acme-ledger")).toBeVisible();
    expect(state.bootstrapCalls).toBe(1);
  });
});
