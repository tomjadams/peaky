/**
 * Shared test utilities for Nitro API handler tests.
 *
 * Eliminates the duplicated boilerplate across every `tests/nuxt/api/*.test.ts`
 * file: Nitro global stubs, mock event factory, and state reset helpers.
 *
 * ## Usage
 *
 *   import { setupNitroStubs, resetNitroStubs, setRouterParam, setBody, setQuery, setHeader } from "../helpers/nitro";
 *
 *   describe("My handler", () => {
 *     const stubs = setupNitroStubs();        // beforeAll/afterAll lifecycle
 *
 *     beforeEach(() => resetNitroStubs(stubs)); // clear per-test state
 *
 *     it("works", async () => {
 *       setRouterParam(stubs, "id", "abc");
 *       setBody(stubs, { name: "Test" });
 *       const result = await handler({} as never);
 *     });
 *   });
 *
 * @see tests/nuxt/api/ — All Nitro handler tests
 */

import { vi, beforeAll, afterAll } from "vitest";
import type { H3Event } from "h3";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NitroStubs {
  routerParams: Record<string, string | undefined>;
  body: { value: unknown };
  query: Record<string, unknown>;
  headers: Record<string, string | undefined>;
}

// ---------------------------------------------------------------------------
// Setup & teardown
// ---------------------------------------------------------------------------

/**
 * Install Nitro global stubs (`defineEventHandler`, `getRouterParam`, etc.)
 * once per `describe` block.  Returns a mutable stubs object that tests can
 * manipulate via the setter helpers below.
 */
export function setupNitroStubs(): NitroStubs {
  const stubs: NitroStubs = {
    routerParams: {},
    body: { value: undefined },
    query: {},
    headers: {},
  };

  beforeAll(() => {
    vi.stubGlobal("defineEventHandler", (handler: unknown) => handler);
    vi.stubGlobal(
      "getRouterParam",
      vi.fn((_event: unknown, key: string) => stubs.routerParams[key])
    );
    vi.stubGlobal(
      "readBody",
      vi.fn(async () => stubs.body.value)
    );
    vi.stubGlobal(
      "getQuery",
      vi.fn(() => stubs.query)
    );
    vi.stubGlobal(
      "getHeader",
      vi.fn((_event: unknown, name: string) => stubs.headers[name])
    );
    vi.stubGlobal("setResponseStatus", vi.fn());
    vi.stubGlobal(
      "createError",
      (input: { statusCode: number; statusMessage: string }) =>
        Object.assign(new Error(input.statusMessage), input)
    );
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  return stubs;
}

/**
 * Reset all per-request state between tests.
 */
export function resetNitroStubs(stubs: NitroStubs): void {
  stubs.routerParams = {};
  stubs.body.value = undefined;
  stubs.query = {};
  stubs.headers = {};
}

// ---------------------------------------------------------------------------
// Per-test setters (mutate the shared stubs object)
// ---------------------------------------------------------------------------

export function setRouterParam(
  stubs: NitroStubs,
  key: string,
  value: string
): void {
  stubs.routerParams[key] = value;
}

export function setBody(stubs: NitroStubs, value: unknown): void {
  stubs.body.value = value;
}

export function setQuery(
  stubs: NitroStubs,
  query: Record<string, unknown>
): void {
  Object.assign(stubs.query, query);
}

export function setHeader(stubs: NitroStubs, key: string, value: string): void {
  stubs.headers[key] = value;
}

export function setActorHeaders(
  stubs: NitroStubs,
  actor: { id: string; name: string; roles: string }
): void {
  stubs.headers["x-actor-id"] = actor.id;
  stubs.headers["x-actor-name"] = actor.name;
  stubs.headers["x-actor-roles"] = actor.roles;
}

// ---------------------------------------------------------------------------
// Mock event factory
// ---------------------------------------------------------------------------

export function createMockEvent(): H3Event {
  return { context: {} } as H3Event;
}
