import { expect, test } from "@playwright/test";

test.describe("Events Page", () => {
  test("shows the audit feed and supports quick filtering", async ({
    page,
  }) => {
    await page.goto("/teams");

    await page.getByRole("link", { name: "Events" }).click();

    await expect(page).toHaveURL(/\/events$/);
    await expect(
      page.getByRole("table", { name: /events/i })
    ).toBeVisible();

    await expect(
      page.getByText("Review Checkpoint Saved").first()
    ).toBeVisible();

    await page
      .getByPlaceholder("Search actors, resources, or event summaries...")
      .fill("CI/CD Pipeline");

    await expect(page.getByText("Answer Imported")).toBeVisible();
  });

  test("admin events SSE stream emits when a new product event arrives", async ({
    page,
  }) => {
    const productName = `[E2E] Live Tail Product ${Date.now()}`;

    await page.goto("/events");
    await page.evaluate(async () => {
      await new Promise<void>((resolve, reject) => {
        const stream = new EventSource("/api/admin/events/stream");
        const timeout = window.setTimeout(() => {
          reject(new Error("SSE connection timeout"));
        }, 5000);

        (window as Window & { __adminEventsHits?: number }).__adminEventsHits =
          0;
        (
          window as Window & { __adminEventsStream?: EventSource }
        ).__adminEventsStream = stream;

        stream.addEventListener("connected", () => {
          window.clearTimeout(timeout);
          resolve();
        });

        stream.addEventListener("admin-events", () => {
          (
            window as Window & { __adminEventsHits?: number }
          ).__adminEventsHits =
            ((window as Window & { __adminEventsHits?: number })
              .__adminEventsHits ?? 0) + 1;
        });
      });
    });

    await page.evaluate(async (name) => {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name,
          origin: "bespoke",
          isExternal: false,
          productManagerId: "heitorl",
          engineeringLeadId: "heitorl",
          teamIds: ["team-customer-portal"],
          componentIds: [],
          roadmapUrl: "",
          documentationUrl: "",
          supportChannel: "",
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create product: ${response.status}`);
      }
    }, productName);

    await page.waitForFunction(() => {
      return (
        ((window as Window & { __adminEventsHits?: number })
          .__adminEventsHits ?? 0) > 0
      );
    });

    await page.evaluate(() => {
      (
        window as Window & { __adminEventsStream?: EventSource }
      ).__adminEventsStream?.close();
    });
  });
});
