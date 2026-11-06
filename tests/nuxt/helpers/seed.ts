/**
 * Server-side seed helpers for integration tests.
 *
 * Creates test data through the same Nitro API handlers that the app uses,
 * mirroring the E2E pattern of seeding via real code paths rather than
 * hardcoded demo data.
 *
 * ## Design
 *
 * Each helper takes a `NitroStubs` object, sets up the request params/body,
 * calls the handler, and returns the created resource.  This means:
 *
 * - Tests own their data (no dependence on hardcoded demo IDs)
 * - Handlers are exercised as part of the seed path (catches regressions)
 * - Data cleanup is trivial: reset the in-memory arrays in `afterEach`
 *
 * @see tests/nuxt/helpers/nitro.ts — Shared Nitro stub setup
 * @see tests/e2e/helpers/seed.ts  — E2E equivalent (browser-side via __peakySeed)
 */

import type { NitroStubs } from "./nitro";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SeededProduct {
  id: string;
  name: string;
  origin: string;
  isExternal: boolean;
}

export interface SeededReview {
  id: string;
  name: string;
  teamId?: string;
  productId?: string;
  templateIds: string[];
  status: string;
}

export interface SeededTemplate {
  id: string;
  name: string;
  status: string;
  description?: string;
}

// ---------------------------------------------------------------------------
// Product seeding
// ---------------------------------------------------------------------------

export async function seedProduct(
  stubs: NitroStubs,
  handler: (event: never) => Promise<unknown>,
  overrides: Record<string, unknown> = {}
): Promise<SeededProduct> {
  stubs.body.value = {
    name: "Test Product",
    origin: "bespoke",
    isExternal: false,
    productManagerId: "test-user",
    teamIds: ["test-team"],
    ...overrides,
  };

  const result = (await handler({} as never)) as SeededProduct;
  return result;
}

// ---------------------------------------------------------------------------
// Template seeding
// ---------------------------------------------------------------------------

export async function seedTemplate(
  stubs: NitroStubs,
  handler: (event: never) => Promise<unknown>,
  overrides: Record<string, unknown> = {}
): Promise<SeededTemplate> {
  stubs.body.value = {
    name: "Test Template",
    description: "A test template for integration tests",
    ...overrides,
  };

  const result = (await handler({} as never)) as { template: SeededTemplate };
  return result.template;
}

// ---------------------------------------------------------------------------
// Review seeding (team reviews)
// ---------------------------------------------------------------------------

export async function seedTeamReview(
  stubs: NitroStubs,
  handler: (event: never) => Promise<unknown>,
  teamId: string,
  overrides: Record<string, unknown> = {}
): Promise<SeededReview> {
  stubs.routerParams = { id: teamId };
  stubs.body.value = {
    name: "Test Review",
    templateIds: ["01932b3c-7d00-7000-8000-000000001001"],
    ...overrides,
  };

  const result = (await handler({} as never)) as SeededReview;
  return result;
}

// ---------------------------------------------------------------------------
// State reset helpers
// ---------------------------------------------------------------------------

/**
 * Reset an in-memory array to its initial state.
 * Replaces the fragile structuredClone backup/restore pattern.
 */
export function resetArray<T>(target: T[], initial: T[]): void {
  target.splice(0, target.length, ...structuredClone(initial));
}
