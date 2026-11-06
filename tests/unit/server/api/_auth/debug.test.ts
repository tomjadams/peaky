import { describe, it, expect, afterEach, vi } from "vitest";
import { debugEnabled } from "../../../../../server/utils/auth/debug-gate";

describe("auth debug endpoint gating", () => {
  const originalDebug = process.env.NUXT_OIDC_AUTH_DEBUG;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalVercelEnv = process.env.VERCEL_ENV;

  afterEach(() => {
    if (originalDebug === undefined) delete process.env.NUXT_OIDC_AUTH_DEBUG;
    else process.env.NUXT_OIDC_AUTH_DEBUG = originalDebug;
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalVercelEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = originalVercelEnv;
    vi.restoreAllMocks();
  });

  it("debugEnabled() is false when NUXT_OIDC_AUTH_DEBUG is unset", () => {
    delete process.env.NUXT_OIDC_AUTH_DEBUG;
    expect(debugEnabled()).toBe(false);
  });

  it("debugEnabled() is false when NUXT_OIDC_AUTH_DEBUG='0' (operator mis-set)", () => {
    process.env.NUXT_OIDC_AUTH_DEBUG = "0";
    expect(debugEnabled()).toBe(false);
  });

  it("debugEnabled() is false when NUXT_OIDC_AUTH_DEBUG='true' (string mismatch)", () => {
    process.env.NUXT_OIDC_AUTH_DEBUG = "true";
    expect(debugEnabled()).toBe(false);
  });

  it("debugEnabled() is true when NUXT_OIDC_AUTH_DEBUG='1' outside production", () => {
    process.env.NODE_ENV = "development";
    process.env.NUXT_OIDC_AUTH_DEBUG = "1";
    expect(debugEnabled()).toBe(true);
  });

  it("debugEnabled() is false in production even when NUXT_OIDC_AUTH_DEBUG='1'", () => {
    process.env.NODE_ENV = "production";
    process.env.NUXT_OIDC_AUTH_DEBUG = "1";
    expect(debugEnabled()).toBe(false);
  });

  it("debugEnabled() does not consider VERCEL_ENV; NODE_ENV is the production backstop", () => {
    process.env.NODE_ENV = "development";
    process.env.NUXT_OIDC_AUTH_DEBUG = "1";
    process.env.VERCEL_ENV = "production";
    expect(debugEnabled()).toBe(true);

    process.env.VERCEL_ENV = "preview";
    expect(debugEnabled()).toBe(true);

    delete process.env.VERCEL_ENV;
    expect(debugEnabled()).toBe(true);
  });
});
