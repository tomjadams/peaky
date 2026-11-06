import { test, expect } from "./helpers/fixtures";

test.use({ viewport: { width: 1440, height: 900 } });

test("centers list and overview pages in the space beside navigation", async ({
  page,
  seed,
}) => {
  const cases = [
    { path: "/teams", container: ".teams-dashboard__container" },
    { path: "/products", container: ".products-dashboard__container" },
    {
      path: `/teams/${seed.team.id}`,
      container: ".team-details__container",
    },
    {
      path: `/products/${seed.product.id}`,
      container: ".product-details__container",
    },
  ];

  for (const item of cases) {
    await page.goto(item.path);
    await page.waitForLoadState("domcontentloaded");

    const sidebar = page.locator(".nav-sidebar");
    const container = page.locator(item.container);
    await expect(sidebar).toBeVisible();
    await expect(container).toBeVisible();

    await expect
      .poll(async () => {
        const [sidebarBox, containerBox, contentWidth] = await Promise.all([
          sidebar.boundingBox(),
          container.boundingBox(),
          page.evaluate(() => document.documentElement.clientWidth),
        ]);
        if (!sidebarBox || !containerBox) return Number.POSITIVE_INFINITY;
        const leftGutter = containerBox.x - (sidebarBox.x + sidebarBox.width);
        const rightGutter =
          contentWidth - (containerBox.x + containerBox.width);
        return Math.abs(leftGutter - rightGutter);
      })
      .toBeLessThanOrEqual(16);
  }
});
