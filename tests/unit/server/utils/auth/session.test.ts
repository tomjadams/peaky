import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  COOKIE_BUDGET_BYTES,
  enforceCookieBudget,
  sessionByteLength,
} from "../../../../../server/utils/auth/cookie-budget";
import type { AuthSession } from "../../../../../server/utils/auth/session";

function baseSession(overrides: Partial<AuthSession> = {}): AuthSession {
  return {
    sub: "00uhf9thcrWEZyNRe417",
    email: "heitor.lessa@adyen.com",
    name: "Heitor Lessa",
    exp: 1_000_000_000,
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false });
  vi.setSystemTime(1_000_000_000_000);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("enforceCookieBudget (CodeRabbit CR-3)", () => {
  it("returns a fresh copy of the session when under budget", () => {
    const session = baseSession({ id_token: "small.idtoken" });
    const before = JSON.stringify(session);

    const { trimmed, dropped } = enforceCookieBudget(session);

    expect(trimmed).toEqual(session);
    expect(trimmed).not.toBe(session);
    expect(dropped).toEqual([]);
    expect(JSON.stringify(trimmed)).toEqual(before);
    expect(sessionByteLength(trimmed)).toBeLessThanOrEqual(COOKIE_BUDGET_BYTES);
  });

  it("does not mutate the input session", () => {
    const session = baseSession({
      id_token: "x".repeat(COOKIE_BUDGET_BYTES),
      picture: "https://photo.example/heitor.png",
    });
    const snapshot = JSON.stringify(session);

    enforceCookieBudget(session);

    expect(JSON.stringify(session)).toBe(snapshot);
  });

  it("drops id_token first when size exceeds budget", () => {
    const hugeIdToken = "x".repeat(COOKIE_BUDGET_BYTES);
    const session = baseSession({ id_token: hugeIdToken });

    const { trimmed, dropped } = enforceCookieBudget(session);

    expect(trimmed.id_token).toBeUndefined();
    expect(dropped).toContain("id_token");
    expect(sessionByteLength(trimmed)).toBeLessThanOrEqual(COOKIE_BUDGET_BYTES);
  });

  it("keeps dropping heavy optional fields in deterministic order until under budget", () => {
    const huge = baseSession({
      id_token: "x".repeat(COOKIE_BUDGET_BYTES),
      // Dropping id_token alone won't be enough; ensure picture also gets dropped.
      picture: "y".repeat(COOKIE_BUDGET_BYTES),
    });

    const { trimmed, dropped } = enforceCookieBudget(huge);

    expect(trimmed.id_token).toBeUndefined();
    expect(trimmed.picture).toBeUndefined();
    expect(dropped[0]).toBe("id_token");
    expect(dropped[1]).toBe("picture");
    // Required fields survive regardless of how aggressive the trim is.
    expect(trimmed.sub).toBe(huge.sub);
    expect(trimmed.email).toBe(huge.email);
    expect(trimmed.name).toBe(huge.name);
    expect(trimmed.exp).toBe(huge.exp);
    expect(sessionByteLength(trimmed)).toBeLessThanOrEqual(COOKIE_BUDGET_BYTES);
  });

  it("stop-list bounds: drops at most the eligible fields and never the required ones", () => {
    // Make every optional field overflow-worthy
    const offender: Partial<AuthSession> = {};
    for (const key of [
      "id_token",
      "picture",
      "preferred_username",
      "given_name",
      "family_name",
      "email_verified",
    ] as const) {
      offender[key] = "z".repeat(COOKIE_BUDGET_BYTES);
      // groups still optional but type-wise an array — skip array from this check
    }
    const session = baseSession(offender);
    const { trimmed, dropped } = enforceCookieBudget(session);

    expect(trimmed.id_token).toBeUndefined();
    expect(trimmed.picture).toBeUndefined();
    expect(trimmed.preferred_username).toBeUndefined();
    expect(trimmed.given_name).toBeUndefined();
    expect(trimmed.family_name).toBeUndefined();
    expect(trimmed.email_verified).toBeUndefined();
    // Required four remain
    expect(trimmed.sub).toBe("00uhf9thcrWEZyNRe417");
    expect(trimmed.email).toBe("heitor.lessa@adyen.com");
    expect(trimmed.name).toBe("Heitor Lessa");
    expect(typeof trimmed.exp).toBe("number");
    // At least one field was dropped, but the required four stayed.
    expect(dropped.length).toBeGreaterThan(0);
    expect(sessionByteLength(trimmed)).toBeLessThanOrEqual(COOKIE_BUDGET_BYTES);
  });

  it("throws when the required payload alone exceeds the budget", () => {
    const oversized = baseSession({
      sub: "x".repeat(COOKIE_BUDGET_BYTES),
      email: "y".repeat(COOKIE_BUDGET_BYTES),
      name: "z".repeat(COOKIE_BUDGET_BYTES),
    });

    expect(() => enforceCookieBudget(oversized)).toThrow(
      /cookie budget of \d+ bytes/
    );
  });

  it("exposes a sensible budget constant", () => {
    // iron-webcrypto + base64 inflation; stay comfortably under 4 KB
    expect(COOKIE_BUDGET_BYTES).toBeGreaterThan(0);
    expect(COOKIE_BUDGET_BYTES).toBeLessThan(4096);
  });
});
