import { beforeAll, describe, expect, it } from "vitest";
import type { H3Event } from "h3";

type EventHandler = (event: H3Event) => unknown;

let mockRouterParams: Record<string, string> = {};
const responseHeaders = new Map<string, string>();

const defineEventHandler = (handler: EventHandler) => handler as unknown;
const getRouterParam = (_event: H3Event, key: string) => mockRouterParams[key];
const setHeader = (_event: H3Event, key: string, value: string) => {
  responseHeaders.set(key, value);
};
const createError = (opts: { statusCode: number; statusMessage: string }) => {
  const err = new Error(opts.statusMessage) as Error & { statusCode: number };
  err.statusCode = opts.statusCode;
  throw err;
};

Object.assign(globalThis, {
  defineEventHandler,
  getRouterParam,
  setHeader,
  createError,
});

let handler: (event: H3Event) => unknown;

beforeAll(async () => {
  handler = (await import("../../../server/api/migrations/sqlite/[id].get"))
    .default as typeof handler;
});

describe("GET /api/migrations/sqlite/:id", () => {
  it("returns the shared SQL for a known migration", () => {
    mockRouterParams = { id: "0001_initial" };
    responseHeaders.clear();

    const result = handler({} as H3Event);

    expect(responseHeaders.get("content-type")).toBe(
      "text/plain; charset=utf-8"
    );
    expect(result).toContain("CREATE TABLE IF NOT EXISTS subjects");
  });

  it("returns 404 for an unknown migration", () => {
    mockRouterParams = { id: "missing" };

    expect(() => handler({} as H3Event)).toThrow("Migration not found");
  });
});
