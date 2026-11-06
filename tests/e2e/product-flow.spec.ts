import type { Page } from "@playwright/test";
import { test, expect } from "./helpers/fixtures";
import { selectTemplateInWizard } from "./helpers/ui";

const DEMO_PRODUCT_ID = "01932b3c-7d00-7000-8000-000000000001";
const ORR_PUBLISHED_REVISION_ID = "01932b3c-7d00-7000-8100-000000001001";
const ORR_PUBLISHED_NAME = "Operational Readiness Review (ORR)";

async function selectCatalogUser(
  page: Page,
  fieldLabel: string,
  query: string,
  optionPattern: RegExp
): Promise<void> {
  const input = page
    .locator("label", { hasText: fieldLabel })
    .locator("..")
    .getByRole("textbox");

  await input.click();
  await input.fill(query);

  const option = page.getByRole("button", { name: optionPattern });
  await expect(option).toBeVisible({ timeout: 15000 });
  await option.click();
}

async function selectCatalogEntity(
  page: Page,
  placeholder: string,
  query: string,
  optionPattern: RegExp
): Promise<void> {
  const input = page.getByPlaceholder(placeholder);
  await input.click();
  await input.fill(query);

  const option = page.getByRole("button", { name: optionPattern }).first();
  await expect(option).toBeVisible({ timeout: 15000 });
  await option.click();
}

test.describe("Product flow — create product, start review, land on assessment", () => {
  const productName = `[E2E] Product ${Date.now()}`;

  test("opens product details from a non-interactive table cell", async ({
    page,
    seed,
  }) => {
    await page.goto("/products");
    const row = page.locator("tbody tr", { hasText: seed.product.name });
    await expect(row).toBeVisible();

    await row.getByRole("cell", { name: "Bespoke" }).click();

    await expect(page).toHaveURL(`/products/${seed.product.id}`);
  });

  test("Product Review wizard locks exact Revisions and product component scope", async ({
    page,
  }) => {
    const reviewName = `[E2E] Product Wizard Review ${Date.now()}`;
    await page.goto(`/products/${DEMO_PRODUCT_ID}/reviews/new`);

    const breadcrumbs = page.getByLabel("Breadcrumb");
    await expect(
      breadcrumbs.getByRole("link", { name: "Products", exact: true })
    ).toBeVisible();
    await expect(
      breadcrumbs.getByRole("link", {
        name: "Demo Payments Scalability",
        exact: true,
      })
    ).toBeVisible();
    await expect(page.getByText("Step 1 of 2")).toBeVisible();

    const revisionCard = page.getByTestId(
      `template-card-${ORR_PUBLISHED_REVISION_ID}`
    );
    await expect(revisionCard.getByText(ORR_PUBLISHED_NAME)).toBeVisible();
    await expect(revisionCard.getByText("v1", { exact: true })).toBeVisible();
    await expect(revisionCard.getByText(/\d+ pillars/)).toBeVisible();
    await expect(revisionCard.getByText(/\d+ questions/)).toBeVisible();
    await revisionCard.click();
    await page.getByTestId("wizard-next").click();

    await expect(page.getByTestId("wizard-step-2")).toBeVisible();
    await expect(page.getByText("Step 2 of 2")).toBeVisible();
    const fullProduct = page.getByRole("button", { name: /Full product/i });
    await expect(fullProduct).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByText(/Full product · applications \(1\)/)
    ).toBeVisible();
    await expect(page.getByText(`${ORR_PUBLISHED_NAME} · v1`)).toBeVisible();

    await page.getByRole("button", { name: /Specific applications/i }).click();
    const picker = page.getByTestId("product-application-picker");
    await expect(picker).toBeVisible();
    await expect(picker.getByRole("button")).toHaveCount(1);
    const productApplication = page.getByTestId(
      "product-application-modificationqueueprocessor"
    );
    await productApplication.click();
    await page.getByRole("textbox", { name: "Review Name" }).fill(reviewName);
    await page.getByTestId("wizard-create").click();

    await page.waitForURL(
      new RegExp(`/products/${DEMO_PRODUCT_ID}/reviews/[^/]+/assessment$`),
      { timeout: 15_000 }
    );
    await expect(
      page.getByText("Review created", { exact: true })
    ).toBeVisible();
  });

  test("team-owned applications are suggested first but cross-team search still works", async ({
    page,
    seed,
  }) => {
    test.setTimeout(60000);

    await page.goto("/products");
    await expect(page).toHaveURL(/\/products$/);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1000);
    await page
      .getByRole("button", { name: /new product/i })
      .first()
      .click();
    await page.waitForURL(/\/products\/new$/, { timeout: 15000 });
    await expect(page).toHaveURL(/\/products\/new$/);

    await page
      .getByPlaceholder("e.g., Checkout, Launchpad")
      .fill(`[E2E] Scoped Product ${Date.now()}`);
    await page.getByRole("button", { name: /^Bespoke/ }).click();

    await selectCatalogUser(page, "Product manager", "vlad", /vlad\.skuba/i);

    await page.getByRole("button", { name: /continue/i }).click();
    await selectCatalogEntity(
      page,
      "Search teams...",
      "payments-scalability",
      /payments-scalability/i
    );
    await page.getByRole("button", { name: /continue/i }).click();

    const scopedApplication = page
      .getByRole("button", { name: /ModificationQueueProcessor/i })
      .first();
    const crossTeamApplication = page
      .getByRole("button", { name: /Launchpad System/i })
      .first();
    const searchInput = page.getByPlaceholder("Search applications...");

    await expect(scopedApplication).toBeVisible();
    await expect(crossTeamApplication).toHaveCount(0);

    await searchInput.fill("launchpad");
    await expect(crossTeamApplication).toBeVisible({ timeout: 15000 });
  });

  test("full product lifecycle", async ({ page, seed }, testInfo) => {
    testInfo.setTimeout(60000);

    // Capture browser console for debugging
    page.on("console", (msg) => {
      const text = msg.text();
      if (
        text.includes("error") ||
        text.includes("Error") ||
        text.includes("local-db") ||
        text.includes("navigation")
      ) {
        console.log(`[browser] ${msg.type()}: ${text}`);
      }
    });

    // Capture page errors
    page.on("pageerror", (error) => {
      console.log(`[browser pageerror] ${error.message}`);
    });

    // ── Step 1: Navigate to products page ──────────────────────
    await page.goto("/products");
    await expect(page).toHaveURL(/\/products$/);

    // ── Step 2: Start new product creation ─────────────────────
    // Wait for hydration then click
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1000);
    await page
      .getByRole("button", { name: /new product/i })
      .first()
      .click();
    // Wait for navigation
    await page.waitForURL(/\/products\/new$/, { timeout: 15000 });
    await expect(page).toHaveURL(/\/products\/new$/);

    // ── Step 3: Fill Identity step ─────────────────────────────
    await page.getByPlaceholder("e.g., Checkout, Launchpad").fill(productName);

    // Select origin (Bespoke)
    await page.getByRole("button", { name: /^Bespoke/ }).click();

    // Select Product Manager via autocomplete
    await selectCatalogUser(page, "Product manager", "vlad", /vlad\.skuba/i);

    // Continue to step 2 (Teams)
    await page.getByRole("button", { name: /continue/i }).click();

    // ── Step 4: Select a team ──────────────────────────────────
    await selectCatalogEntity(
      page,
      "Search teams...",
      "payments-scalability",
      /payments-scalability/i
    );
    await page.getByRole("button", { name: /continue/i }).click();

    // ── Step 5: Skip applications (optional) ───────────────────
    await page.getByRole("button", { name: /skip/i }).click();

    // ── Step 6: Review step — verify summary and create ────────
    // Scoped to the review sheet: the rail and the legend show the same
    // words, so an unscoped text match would be ambiguous.
    const reviewStep = page.getByTestId("product-wizard-review");
    await expect(reviewStep.getByText(productName)).toBeVisible();
    await expect(reviewStep.getByText("Bespoke")).toBeVisible();

    await page.getByRole("button", { name: /create product/i }).click();

    // Should navigate to the new product's details page
    await page.waitForURL(/\/products\/[^/]+$/, { timeout: 15000 });
    await expect(
      page.getByText("Product created", { exact: true })
    ).toBeVisible();

    // ── Step 7: Verify product details page ────────────────────
    await expect(
      page.getByRole("heading", { name: productName, level: 1 })
    ).toBeVisible();

    // Verify overview sections exist
    await expect(
      page.getByRole("heading", { name: "Ownership and resources" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Teams", level: 3 })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Applications", level: 3 })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "References", level: 3 })
    ).toBeVisible();

    // Verify contact resolved to display name
    await expect(page.getByRole("link", { name: "Vlad Skuba" })).toBeVisible();

    // ── Step 7b: Product should also appear in the dashboard after navigation ─────
    await page.goto("/products");
    await expect(page.getByRole("cell", { name: productName })).toBeVisible();

    // ── Step 8: Start a review for the local-only product ───────────────
    await page.getByRole("link", { name: productName }).click();
    await expect(page).toHaveURL(/\/products\/[^/]+$/);

    await page
      .getByRole("link", { name: /start new review/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/products\/[^/]+\/reviews\/new$/);

    await page.waitForLoadState("domcontentloaded");
    await selectTemplateInWizard(page, seed.template);
    await expect(page.getByTestId("wizard-next")).toBeEnabled();
    await page.getByTestId("wizard-next").click();

    await expect(page.getByTestId("wizard-step-2")).toBeVisible();
    const reviewName = `[E2E] Review ${Date.now()}`;
    await page.getByRole("textbox").first().fill(reviewName);
    await page.getByTestId("wizard-create").click();

    await page.waitForURL(/\/products\/[^/]+\/reviews\/[^/]+\/assessment$/, {
      timeout: 15000,
    });
    await expect(
      page.getByText("Review created", { exact: true })
    ).toBeVisible();
    await expect(page.getByText(/loading review/i)).not.toBeVisible({
      timeout: 15000,
    });

    // Review details route should work for local-only reviews
    await page.getByRole("link", { name: /review/i }).click();
    await expect(page).toHaveURL(/\/products\/[^/]+\/reviews\/[^/]+$/);
    await expect(
      page.getByRole("heading", { name: reviewName }).first()
    ).toBeVisible();

    // Product details should list the locally created review
    // Navigate back to the product page by extracting its URL from the current review URL
    const reviewDetailsUrl = page.url();
    const productUrl = reviewDetailsUrl.split("/reviews/")[0];
    await page.goto(productUrl);
    await expect(page).toHaveURL(/\/products\/[^/]+$/);
    await expect(page.getByRole("cell", { name: reviewName })).toBeVisible();

    // ── Step 9: Archive, restore, then permanently delete the local review ─────
    const reviewRow = page.getByRole("row").filter({ hasText: reviewName });
    await reviewRow.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("menuitem", { name: "Archive" }).click();

    const reviewArchiveDialog = page.getByRole("dialog");
    await expect(reviewArchiveDialog).toBeVisible();
    await expect(reviewArchiveDialog).toContainText(`Archive ${reviewName}?`);
    await expect(reviewArchiveDialog).toContainText(
      "Archive is not permanent delete"
    );

    await reviewArchiveDialog
      .getByRole("button", { name: /archive review/i })
      .click();

    await expect(
      page.getByText("Review archived", { exact: true })
    ).toBeVisible();
    await expect(page.getByRole("cell", { name: reviewName })).toHaveCount(0);

    await page.getByRole("button", { name: /archived \(1\)/i }).click();
    const archivedReviewRow = page
      .getByRole("row")
      .filter({ hasText: reviewName });
    await expect(archivedReviewRow).toBeVisible();

    await archivedReviewRow
      .getByRole("button", { name: "More actions" })
      .click();
    await page.getByRole("menuitem", { name: "Restore" }).click();

    await expect(
      page.getByText("Review restored", { exact: true })
    ).toBeVisible();
    await expect(page.getByRole("cell", { name: reviewName })).toHaveCount(0);

    await page.getByRole("button", { name: /active \(1\)/i }).click();
    const restoredReviewRow = page
      .getByRole("row")
      .filter({ hasText: reviewName });
    await restoredReviewRow
      .getByRole("button", { name: "More actions" })
      .click();
    await page.getByRole("menuitem", { name: "Archive" }).click();

    await page
      .getByRole("dialog")
      .getByRole("button", { name: /archive review/i })
      .click();

    await expect(
      page.getByText("Review archived", { exact: true })
    ).toBeVisible();
    await page.getByRole("button", { name: /archived \(1\)/i }).click();

    const archivedReviewForDelete = page
      .getByRole("row")
      .filter({ hasText: reviewName });
    await archivedReviewForDelete
      .getByRole("button", { name: "More actions" })
      .click();
    await page.getByRole("menuitem", { name: "Delete" }).click();

    const reviewDeleteDialog = page.getByRole("dialog");
    await expect(reviewDeleteDialog).toContainText(
      `Delete ${reviewName} permanently?`
    );
    await expect(reviewDeleteDialog).toContainText(
      "assessment answers, notes, attachments, and audit history references"
    );
    await reviewDeleteDialog.getByRole("textbox").fill(reviewName);
    await reviewDeleteDialog
      .getByRole("button", { name: /delete permanently/i })
      .click();

    await expect(
      page.getByText("Review deleted permanently", { exact: true })
    ).toBeVisible();
    await expect(page.getByRole("cell", { name: reviewName })).toHaveCount(0);

    await page.getByRole("button", { name: /active \(0\)/i }).click();

    // ── Step 10: Archive the local test product from the dashboard ─────────────────
    await page.goto("/products");
    const productRow = page.getByRole("row").filter({ hasText: productName });
    await expect(productRow).toBeVisible();

    await productRow.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("menuitem", { name: "Archive" }).click();

    const archiveDialog = page.getByRole("dialog");
    await expect(archiveDialog).toBeVisible();
    await expect(
      archiveDialog.getByRole("heading", { name: `Archive ${productName}?` })
    ).toBeVisible();
    await expect(archiveDialog).toContainText(
      "Archive is not permanent delete"
    );
    await expect(archiveDialog).toContainText("Archived products");
    await expect(archiveDialog).toContainText("restore it later");

    await archiveDialog
      .getByRole("button", { name: /archive product/i })
      .click();

    await expect(
      page.getByText("Product archived", { exact: true })
    ).toBeVisible();
    await expect(page.getByRole("cell", { name: productName })).toHaveCount(0);

    // ── Step 11: Restore the archived product from the archived surface ──────────
    await page.getByRole("button", { name: /archived/i }).click();

    const archivedProductRow = page
      .getByRole("row")
      .filter({ hasText: productName });
    await expect(archivedProductRow).toBeVisible();

    await archivedProductRow
      .getByRole("button", { name: "More actions" })
      .click();
    await page.getByRole("menuitem", { name: "Restore" }).click();

    await expect(
      page.getByText("Product restored", { exact: true })
    ).toBeVisible();
    await expect(page.getByRole("cell", { name: productName })).toHaveCount(0);

    await page.getByRole("button", { name: /active/i }).click();
    await expect(page.getByRole("cell", { name: productName })).toBeVisible();

    // ── Step 12: Archive again, then permanently delete from Archived products ───
    const restoredProductRow = page
      .getByRole("row")
      .filter({ hasText: productName });
    await restoredProductRow
      .getByRole("button", { name: "More actions" })
      .click();
    await page.getByRole("menuitem", { name: "Archive" }).click();

    await expect(page.getByRole("dialog")).toBeVisible();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /archive product/i })
      .click();

    await expect(
      page.getByText("Product archived", { exact: true })
    ).toBeVisible();

    await page.getByRole("button", { name: /archived/i }).click();

    const archivedProductRowForDelete = page
      .getByRole("row")
      .filter({ hasText: productName });
    await expect(archivedProductRowForDelete).toBeVisible();
    await archivedProductRowForDelete
      .getByRole("button", { name: "More actions" })
      .click();
    await page.getByRole("menuitem", { name: "Delete" }).click();

    const deleteDialog = page.getByRole("dialog");
    await expect(deleteDialog).toBeVisible();
    await expect(
      deleteDialog.getByRole("heading", {
        name: `Delete ${productName} permanently?`,
      })
    ).toBeVisible();
    await expect(deleteDialog).toContainText(
      "This permanently removes the archived product"
    );
    await expect(deleteDialog).toContainText("Permanent removal");
    await expect(deleteDialog).toContainText(
      "cannot be undone or restored later"
    );
    await deleteDialog.getByRole("textbox").fill(productName);

    await deleteDialog
      .getByRole("button", { name: /delete permanently/i })
      .click();

    await expect(
      page.getByText("Product deleted permanently", { exact: true })
    ).toBeVisible();
    await expect(page.getByRole("cell", { name: productName })).toHaveCount(0);

    await page.getByRole("button", { name: /active/i }).click();
    await expect(page.getByRole("cell", { name: productName })).toHaveCount(0);

    // Local-first review creation works end-to-end for local-only products
  });
});
