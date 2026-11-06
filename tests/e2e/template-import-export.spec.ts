/**
 * E2E tests for the template markdown import/export workflow.
 *
 * The Template Studio provides a markdown modal that lets users:
 *  - **Export**: view the template as markdown, copy to clipboard
 *  - **Import**: paste markdown to replace the template content
 *
 * These tests verify the full round-trip: export → modify → import → verify.
 * The flow test at the end verifies an imported template can be published
 * and used to create a review.
 *
 * @see app/components/template-studio/MarkdownModal.vue
 * @see app/composables/local/useLocalTemplateImport.ts
 * @see tests/e2e/fixtures/seed-template.md — Canonical seed template
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "./helpers/fixtures";
import { seedTemplate } from "./helpers/seed";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadFixture(name: string): string {
  return readFileSync(resolve(__dirname, "fixtures", name), "utf-8");
}

test.describe("Template Import / Export", () => {
  test.beforeEach(async ({ page, seed }) => {
    await page.goto(`/templates/${seed.template.id}/edit`);
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByTestId("question-card").first()).toBeVisible();
  });

  // ── Export ──────────────────────────────────────────────────────────────

  test("export modal shows template as markdown", async ({ page, seed }) => {
    // Open markdown modal via header button
    await page.getByTestId("markdown-modal-trigger").click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Should default to export mode
    await expect(
      dialog.getByRole("heading", { name: /export as markdown/i })
    ).toBeVisible();

    // Should contain template name and pillar names from the seed
    const textarea = dialog.locator("textarea");
    await expect(textarea).toBeVisible();
    const markdown = await textarea.inputValue();

    expect(markdown).toContain("# Template:");
    expect(markdown).toContain("## Pillar: Reliability");
    expect(markdown).toContain("## Pillar: Security");
    expect(markdown).toContain("failover test");
    expect(markdown).toContain("**Type:** checklist");
    expect(markdown).toContain("**Checklist Items:**");
  });

  test("copy button copies markdown to clipboard", async ({ page, seed }) => {
    // Grant clipboard permission
    await page
      .context()
      .grantPermissions(["clipboard-read", "clipboard-write"]);

    await page.getByTestId("markdown-modal-trigger").click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: /copy all/i }).click();
    await expect(dialog.getByRole("button", { name: /copied/i })).toBeVisible();

    // Verify clipboard content
    const clipboardText = await page.evaluate(() =>
      navigator.clipboard.readText()
    );
    expect(clipboardText).toContain("# Template:");
    expect(clipboardText).toContain("## Pillar:");
  });

  // ── Import ─────────────────────────────────────────────────────────────

  test("import mode accepts markdown and replaces template content", async ({
    page,
    seed,
  }) => {
    await page.getByTestId("markdown-modal-trigger").click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Switch to import mode
    await dialog
      .getByRole("button", { name: "Import", exact: true })
      .first()
      .click();
    await expect(
      dialog.getByRole("heading", { name: /import from markdown/i })
    ).toBeVisible();

    // Paste a modified template markdown
    const importMarkdown = [
      "# Template: Imported Readiness Review",
      "",
      "> An imported template with a new pillar.",
      "",

      "---",
      "",
      "## Pillar: Performance",
      "",
      "### Question 1 [High]",
      "",
      "Are response times under 200ms at p99?",
      "",
      "**Why it's important:**",
      "",
      "Latency directly impacts user experience and conversion rates.",
      "",
      "---",
      "",
      "## Pillar: Observability",
      "",
      "### Question 2 [Critical]",
      "",
      "Do you have distributed tracing enabled?",
      "",
      "---",
    ].join("\n");

    await dialog.locator("textarea").fill(importMarkdown);

    const reviewButton = dialog.getByRole("button", { name: "Review import" });
    await expect(reviewButton).toBeEnabled();
    await reviewButton.click();
    await expect(
      dialog.getByRole("heading", { name: "Review import" })
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Replace template" }).click();

    // Modal should close
    await expect(dialog).not.toBeVisible();

    // Template editor should now show the imported pillars as tabs
    const pillarTabs = page.locator("[role='button']");
    await expect(pillarTabs.filter({ hasText: "Performance" })).toBeVisible();
    await expect(pillarTabs.filter({ hasText: "Observability" })).toBeVisible();

    // Active pillar (Performance) should show its question
    await expect(
      page.getByText("Are response times under 200ms at p99?")
    ).toBeVisible();

    // Click Observability tab and verify its question
    await pillarTabs.filter({ hasText: "Observability" }).click();
    await expect(
      page.getByText("Do you have distributed tracing enabled?")
    ).toBeVisible();
  });

  test("import shows parse error for invalid markdown", async ({
    page,
    seed,
  }) => {
    await page.getByTestId("markdown-modal-trigger").click();

    const dialog = page.getByRole("dialog");

    // Switch to import mode
    await dialog
      .getByRole("button", { name: "Import", exact: true })
      .first()
      .click();

    // Paste markdown without any ## Pillar: headers
    await dialog.locator("textarea").fill("# Just a title\n\nNo pillars here.");

    await dialog.getByRole("button", { name: "Review import" }).click();

    // Should show parse error
    await expect(dialog.getByText(/no pillars found/i)).toBeVisible();
  });

  // ── Round-trip ─────────────────────────────────────────────────────────

  test("export → import round-trip preserves template structure", async ({
    page,
    seed,
  }) => {
    // Step 1: Export the current template
    await page.getByTestId("markdown-modal-trigger").click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    const textarea = dialog.locator("textarea");
    const exportedMarkdown = await textarea.inputValue();

    // Close modal
    await dialog.getByRole("button", { name: /close/i }).click();
    await expect(dialog).not.toBeVisible();

    // Step 2: Re-import the same markdown
    await page.getByTestId("markdown-modal-trigger").click();
    await expect(dialog).toBeVisible();

    await dialog
      .getByRole("button", { name: "Import", exact: true })
      .first()
      .click();
    await dialog.locator("textarea").fill(exportedMarkdown);

    await dialog.getByRole("button", { name: "Review import" }).click();
    await dialog.getByRole("button", { name: "Replace template" }).click();
    await expect(dialog).not.toBeVisible();

    // Step 3: Export again and verify content is preserved
    await page.getByTestId("markdown-modal-trigger").click();
    await expect(dialog).toBeVisible();

    const reExportedMarkdown = await dialog.locator("textarea").inputValue();

    // Core structure should be preserved
    expect(reExportedMarkdown).toContain("## Pillar: Reliability");
    expect(reExportedMarkdown).toContain("## Pillar: Security");
    expect(reExportedMarkdown).toContain("failover test");
    expect(reExportedMarkdown).toContain("security review practices");
    expect(reExportedMarkdown).toContain("**Type:** checklist");
    expect(reExportedMarkdown).toContain("**Checklist Items:**");
  });

  test("import button is disabled when textarea is empty", async ({
    page,
    seed,
  }) => {
    await page.getByTestId("markdown-modal-trigger").click();

    const dialog = page.getByRole("dialog");

    // Switch to import mode
    await dialog
      .getByRole("button", { name: "Import", exact: true })
      .first()
      .click();

    await expect(
      dialog.getByRole("button", { name: "Review import" })
    ).toBeDisabled();
  });
});

// ── Flow: import → local save → review-selection exclusion ──────────
//
// Verifies that an imported local draft stays out of Review selection.

test.describe("Template Import Flow", () => {
  test("imported local draft is not review-selectable", async ({
    page,
    seed,
  }) => {
    test.setTimeout(60000);

    const ts = Date.now();
    // This name will be set after import (the import overwrites the name
    // with the markdown's `# Template:` header, so we rename afterwards).
    const templateName = `[E2E] Imported ORR ${ts}`;

    // ── Step 1: Create a fresh template draft via seed ──────────────
    const templateId = await seedTemplate(page, {
      name: `[E2E] Draft ${ts}`,
      description: "Template for import flow test",
    });

    await page.goto(`/templates/${templateId}/edit`);
    await page.waitForLoadState("domcontentloaded");
    await expect(
      page.getByRole("button", { name: `[E2E] Draft ${ts}` })
    ).toBeVisible();

    // ── Step 2: Import the fixture markdown ─────────────────────────
    const fixtureMarkdown = loadFixture("seed-template.md");

    await page.getByTestId("markdown-modal-trigger").click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await dialog
      .getByRole("button", { name: "Import", exact: true })
      .first()
      .click();
    await dialog.locator("textarea").fill(fixtureMarkdown);

    await dialog.getByRole("button", { name: "Review import" }).click();
    await dialog.getByRole("button", { name: "Replace template" }).click();
    await expect(dialog).not.toBeVisible();

    // Verify pillars landed in the editor
    const pillarTabs = page.locator("[role='button']");
    await expect(pillarTabs.filter({ hasText: "Reliability" })).toBeVisible();
    await expect(pillarTabs.filter({ hasText: "Security" })).toBeVisible();

    await page.getByTestId("markdown-modal-trigger").click();
    await expect(dialog).toBeVisible();
    const reExportedMarkdown = await dialog.locator("textarea").inputValue();
    expect(reExportedMarkdown).toContain("**Type:** checklist");
    expect(reExportedMarkdown).toContain("**Checklist Items:**");
    expect(reExportedMarkdown).toContain(
      "- Code review for security-sensitive changes"
    );
    expect(reExportedMarkdown).toContain("- Dependency vulnerability scanning");
    expect(reExportedMarkdown).toContain("- Penetration testing schedule");
    await dialog.getByRole("button", { name: /close/i }).click();

    // Rename the template (import overwrote the name with the fixture's)
    // so we can search for it uniquely in the wizard
    const headerNameButton = page.getByRole("button", {
      name: /Operational Readiness Review/i,
    });
    await headerNameButton.click();
    const nameInput = page.locator("#template-details-name");
    await expect(nameInput).toBeVisible();
    await nameInput.fill(templateName);
    await page.getByRole("button", { name: "Done" }).click();

    // Save the imported content locally
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: "Publish" })).toHaveCount(0);

    await page.goto(`/teams/${seed.team.id}/reviews/new`);
    await page.getByPlaceholder("Search Revisions...").fill(templateName);
    await expect(page.getByText(templateName, { exact: true })).toHaveCount(0);
  });
});
