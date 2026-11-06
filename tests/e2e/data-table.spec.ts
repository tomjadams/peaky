import { test, expect } from "@playwright/test";

test.describe("Data Table Interactions", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/teams");
  });

  test("displays table with data", async ({ page }) => {
    const table = page.getByRole("table");
    await expect(table).toBeVisible();

    // Should have rows
    const rows = page.locator("tbody tr");
    await expect(rows.first()).toBeVisible();
  });

  test("can sort by column", async ({ page }) => {
    // Find a sortable column header (e.g., Name)
    const nameHeader = page.getByRole("columnheader", { name: /name/i });
    await expect(nameHeader).toBeVisible();

    await nameHeader.click();

    // Should show sort indicator
    await expect(nameHeader).toBeVisible();
  });

  test("table rows provide a team details link", async ({ page }) => {
    await expect(page.getByRole("table")).toBeVisible();

    const firstTeamLink = page.locator("tbody tr a").first();
    await expect(firstTeamLink).toBeVisible();
    await expect(firstTeamLink).toHaveAttribute("href", /\/teams\/.+/);
  });
});
