import { test, expect } from "./helpers/fixtures";

test.describe("Templates Page", () => {
  test.beforeEach(async ({ page, seed }) => {
    await page.goto("/templates");
  });

  test("displays templates list", async ({ page, seed }) => {
    // Wait for templates to load - check table has rows
    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.locator("tbody tr").first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("opens a safe view before allowing an explicit edit transition", async ({
    page,
    seed,
  }) => {
    const templateRow = page.locator("tbody tr", {
      hasText: seed.template.name,
    });
    await expect(templateRow).toBeVisible({ timeout: 10000 });

    await templateRow.click();
    await expect(page.getByText("Read-only", { exact: true })).toBeVisible();

    await page.getByRole("link", { name: "Edit draft" }).click();
    await expect(
      page.getByText("Read-only", { exact: true })
    ).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: "Save Draft" })
    ).toBeVisible();
  });

  test("can navigate to template editor", async ({ page, seed }) => {
    // Wait for table to load
    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.locator("tbody tr").first()).toBeVisible();

    // Use the Create Template link which we know works
    await page.getByRole("link", { name: "Create Template" }).click();

    // Should navigate to template editor
    await expect(page).toHaveURL(/\/templates\/new\/edit/);
  });
});

test.describe("Template Studio", () => {
  test("saves a new draft locally and reopens it from the templates list", async ({
    page,
    seed,
  }) => {
    const draftName = `[E2E] Draft ${Date.now()}`;

    await page.goto("/templates");
    await page.getByRole("link", { name: "Create Template" }).click();
    await expect(page).toHaveURL(/\/templates\/new\/edit/);

    await page.getByRole("button", { name: "Untitled Template" }).click();
    const nameInput = page.locator("#template-details-name");
    await expect(nameInput).toBeVisible();
    await nameInput.fill(draftName);
    await page.getByRole("combobox", { name: "Owner Team" }).click();
    await page.getByRole("option").first().click();
    await page.getByRole("button", { name: "Done" }).click();

    await page.getByRole("button", { name: "Save" }).click();
    await expect
      .poll(() => new URL(page.url()).pathname.split("/")[2])
      .not.toBe("new");

    const draftUrl = page.url();
    const draftId = draftUrl.match(/\/templates\/([^/]+)\/edit/)?.[1];
    expect(draftId).toBeTruthy();

    await page.goto("/templates");
    const draftRow = page.locator("tbody tr", { hasText: draftName });
    await expect(draftRow).toBeVisible({ timeout: 10000 });

    await draftRow.getByText(draftName).click();
    await expect(page).toHaveURL(
      new RegExp(`/templates/${draftId}/edit\\?mode=view$`)
    );
    await expect(page.getByText("Read-only", { exact: true })).toBeVisible();

    await page.getByRole("link", { name: "Edit draft" }).click();
    await expect(page).toHaveURL(new RegExp(`/templates/${draftId}/edit$`));
    await expect(page.getByRole("button", { name: draftName })).toBeVisible();
  });
});

test.describe("Template Studio - Preview Mode", () => {
  test("N/A flow works end-to-end in preview mode", async ({ page, seed }) => {
    await page.goto(`/templates/${seed.template.id}/edit`);
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/templates\/.*\/edit/);

    // Open preview mode
    const previewTrigger = page.getByRole("button", {
      name: "Preview",
      exact: true,
    });
    await expect(previewTrigger).toBeVisible({ timeout: 10000 });
    await previewTrigger.click();

    // Verify the preview dialog and its concise visible identity.
    const previewDialog = page.getByRole("dialog", {
      name: "Template preview",
    });
    await expect(previewDialog).toBeVisible({ timeout: 10000 });
    await expect(
      previewDialog.getByText("Preview", { exact: true })
    ).toBeVisible();

    // Find an N/A button and click it.
    const naButton = previewDialog
      .getByRole("button", { name: "N/A", exact: true })
      .first();
    await expect(naButton).toBeVisible();
    await naButton.click();

    // Verify the slideover opens without stacking another modal.
    await expect(
      page.getByText("Why is this question not applicable?")
    ).toBeVisible({ timeout: 5000 });

    // Select a reason and confirm it.
    await page.getByRole("radio", { name: /Not in scope/i }).click();
    await page.getByRole("button", { name: /Confirm/i }).click();

    // Verify the slideover closed and N/A is reflected in preview.
    await expect(
      page.getByText("Why is this question not applicable?")
    ).not.toBeVisible();
    await expect(naButton).toHaveAttribute("aria-pressed", "true");

    await previewDialog.getByRole("button", { name: "Exit preview" }).click();
    await expect(previewDialog).not.toBeVisible();

    await previewTrigger.click();
    await expect(previewDialog).toBeVisible();
    await expect(naButton).toHaveAttribute("aria-pressed", "true");
    await expect(
      previewDialog.getByTestId("preview-navigation").getByText("50% answered")
    ).toBeVisible();
    await expect(
      previewDialog.locator('[data-variant="flat"]').first()
    ).toBeVisible();
    await expect(
      previewDialog.getByText("Template pillar", { exact: true })
    ).toHaveCount(0);
    await previewDialog.getByRole("button", { name: "Exit preview" }).click();
  });

  test("Info panel opens correctly in preview mode", async ({ page, seed }) => {
    await page.goto(`/templates/${seed.template.id}/edit`);
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/templates\/.*\/edit/);

    // Open preview mode
    const previewTrigger = page.getByRole("button", {
      name: "Preview",
      exact: true,
    });
    await expect(previewTrigger).toBeVisible({ timeout: 10000 });
    await previewTrigger.click();

    // Verify the preview dialog and its concise visible identity.
    const previewDialog = page.getByRole("dialog", {
      name: "Template preview",
    });
    await expect(previewDialog).toBeVisible({ timeout: 10000 });
    await expect(
      previewDialog.getByText("Preview", { exact: true })
    ).toBeVisible();

    // Open the first question's information panel.
    const infoButton = previewDialog
      .getByRole("button", {
        name: "Show information about this question",
      })
      .first();
    await expect(infoButton).toBeVisible();
    await infoButton.click();

    await expect(page.getByText("Why this matters")).toBeVisible({
      timeout: 5000,
    });
    await expect(
      page.getByText("Failover testing validates disaster recovery procedures.")
    ).toBeVisible();
  });
});
