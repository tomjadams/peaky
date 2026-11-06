/** Persona multi-client e2e helper for entitlement-scoped visibility assertions. */

import type { Browser, BrowserContext, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import type { LifecycleRole } from "~/lifecycle/management";

export interface Persona {
  id: string;
  name: string;
  roles: readonly LifecycleRole[];
}

export interface PersonaHandle {
  context: BrowserContext;
  page: Page;
}

// Each entry must match an actor in services/seed/actors.json.
export const PERSONAS = {
  dev: { id: "actor_dev", name: "Dev (fallback)", roles: ["member"] },
  alice: { id: "actor_alice", name: "Alice", roles: ["member"] },
  bob: { id: "actor_bob", name: "Bob", roles: ["member"] },
  carol: { id: "actor_carol", name: "Carol", roles: ["member"] },
  reviewonly: {
    id: "actor_reviewonly",
    name: "Review Only",
    roles: ["member"],
  },
  scoped: { id: "actor_scoped", name: "Scoped", roles: ["member"] },
} as const satisfies Record<string, Persona>;

/** Wait for the seed plugin + local DB + sync scheduler to be ready. */
export async function awaitSeedReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      Boolean(window.__peakySeed) &&
      window.peakyDB?.isOpen?.() === true &&
      window.peakySyncReady === true,
    undefined,
    { timeout: 30_000 }
  );
}

/** Open a fresh browser context as `persona` and wait for the local DB to be ready. */
export async function personaPage(
  browser: Browser,
  persona: Persona
): Promise<PersonaHandle> {
  const context = await browser.newContext();
  await context.addInitScript(({ id, name, roles }: Persona) => {
    localStorage.setItem(
      "peaky:current-actor",
      JSON.stringify({ id, name, roles })
    );
  }, persona);
  const page = await context.newPage();
  await page.goto("/");
  await awaitSeedReady(page);
  // Cold starts may trigger HMR navigations that destroy the execution
  // context after awaitSeedReady passes. Retry a no-op evaluate to confirm
  // the page is stable before returning it to the caller.
  await expect(async () => {
    await page.evaluate(() => true);
  }).toPass({ timeout: 10_000 });
  return { context, page };
}

/** Force a push+pull cycle now — background tabs are timer-throttled in headless runs. */
export async function syncNow(page: Page): Promise<unknown> {
  await page.bringToFront();
  return page.evaluate(async () => window.__peakySeed!.syncNow());
}

/** True when `persona`'s local DB table contains `needle` (substring match on serialized rows). */
export async function hasLocalRow(
  page: Page,
  table: string,
  needle: string
): Promise<boolean> {
  await awaitSeedReady(page);
  return page.evaluate(
    async ({ tbl, ndl }: { tbl: string; ndl: string }) => {
      const result = await window.peakyDB!.dumpTable(tbl, 500);
      const rows = Array.isArray(result) ? result : result.rows;
      return JSON.stringify(rows).includes(ndl);
    },
    { tbl: table, ndl: needle }
  );
}

/** Assert that `persona`'s local DB eventually contains `needle` — polls with syncNow until it appears. */
export async function expectSees(
  page: Page,
  table: string,
  needle: string,
  timeout = 90_000
): Promise<void> {
  await expect(async () => {
    await syncNow(page);
    expect(await hasLocalRow(page, table, needle)).toBe(true);
  }).toPass({ timeout });
}

/** Assert that `persona`'s local DB does NOT contain `needle` — one-shot, sealing must hold after sync. */
export async function expectDoesNotSee(
  page: Page,
  table: string,
  needle: string
): Promise<void> {
  const seen = await hasLocalRow(page, table, needle);
  expect(seen, `unexpected row "${needle}" present in ${table}`).toBe(false);
}
