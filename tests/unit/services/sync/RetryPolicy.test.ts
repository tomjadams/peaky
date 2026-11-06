import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AdaptiveRetryPolicy,
  defaultRetryPolicy,
  type RetryContext,
} from "~/services/sync/RetryPolicy";

// ---------------------------------------------------------------------------
// AdaptiveRetryPolicy.getDelay
// ---------------------------------------------------------------------------

describe("AdaptiveRetryPolicy.getDelay", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("attempt 0 — delay is in [0, baseDelay]", () => {
    const policy = new AdaptiveRetryPolicy({
      baseDelayMs: 1000,
      maxDelayMs: 60_000,
    });
    for (let i = 0; i < 10; i++) {
      const delay = policy.getDelay(0);
      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThanOrEqual(1000); // base * 2^0 = 1000
    }
  });

  it("attempt 1 — delay is in [0, base * 2]", () => {
    const policy = new AdaptiveRetryPolicy({
      baseDelayMs: 1000,
      maxDelayMs: 60_000,
    });
    for (let i = 0; i < 10; i++) {
      const delay = policy.getDelay(1);
      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThanOrEqual(2000); // base * 2^1 = 2000
    }
  });

  it("attempt 3 — delay is in [0, base * 8] (8000 < maxDelay)", () => {
    const policy = new AdaptiveRetryPolicy({
      baseDelayMs: 1000,
      maxDelayMs: 60_000,
    });
    for (let i = 0; i < 10; i++) {
      const delay = policy.getDelay(3);
      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThanOrEqual(8000); // base * 2^3 = 8000
    }
  });

  it("large attempt — delay is capped at maxDelay", () => {
    const policy = new AdaptiveRetryPolicy({
      baseDelayMs: 1000,
      maxDelayMs: 60_000,
    });
    // base * 2^10 = 1_024_000 — far above cap
    for (let i = 0; i < 10; i++) {
      const delay = policy.getDelay(10);
      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThanOrEqual(60_000);
    }
  });

  it("attempt 100 — still capped at maxDelay", () => {
    const policy = new AdaptiveRetryPolicy({
      baseDelayMs: 1000,
      maxDelayMs: 60_000,
    });
    for (let i = 0; i < 5; i++) {
      expect(policy.getDelay(100)).toBeLessThanOrEqual(60_000);
    }
  });

  it("deterministic jitter: Math.random=0.5 gives exactly half the window", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const policy = new AdaptiveRetryPolicy({
      baseDelayMs: 1000,
      maxDelayMs: 60_000,
    });

    // attempt 2: exponential = 1000 * 4 = 4000; window = min(60000, 4000) = 4000
    // delay = 0.5 * 4000 = 2000
    expect(policy.getDelay(2)).toBe(2000);
  });

  it("deterministic jitter: Math.random=0 gives delay of 0", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const policy = new AdaptiveRetryPolicy({
      baseDelayMs: 1000,
      maxDelayMs: 60_000,
    });
    expect(policy.getDelay(5)).toBe(0);
  });

  it("deterministic jitter: Math.random=1 gives the full window", () => {
    vi.spyOn(Math, "random").mockReturnValue(1);
    const policy = new AdaptiveRetryPolicy({
      baseDelayMs: 1000,
      maxDelayMs: 60_000,
    });
    // attempt 3: exponential = 8000; window = 8000; delay = 1 * 8000 = 8000
    expect(policy.getDelay(3)).toBe(8000);
  });

  it("deterministic jitter: Math.random=1 at high attempt is capped at maxDelay", () => {
    vi.spyOn(Math, "random").mockReturnValue(1);
    const policy = new AdaptiveRetryPolicy({
      baseDelayMs: 1000,
      maxDelayMs: 60_000,
    });
    // window = min(60000, huge) = 60000; delay = 1 * 60000 = 60000
    expect(policy.getDelay(20)).toBe(60_000);
  });

  it("jitter produces variance across repeated calls", () => {
    const policy = new AdaptiveRetryPolicy({
      baseDelayMs: 1000,
      maxDelayMs: 60_000,
    });
    const results = Array.from({ length: 20 }, () => policy.getDelay(3));
    const unique = new Set(results);
    expect(unique.size).toBeGreaterThan(1);
  });

  it("retryAfterMs context overrides calculated backoff", () => {
    const policy = new AdaptiveRetryPolicy({
      baseDelayMs: 1000,
      maxDelayMs: 60_000,
    });
    const ctx: RetryContext = { retryAfterMs: 5000 };
    expect(policy.getDelay(0, ctx)).toBe(5000);
    expect(policy.getDelay(3, ctx)).toBe(5000);
  });

  it("retryAfterMs is clamped to maxDelay when it exceeds it", () => {
    const policy = new AdaptiveRetryPolicy({
      baseDelayMs: 1000,
      maxDelayMs: 60_000,
    });
    expect(policy.getDelay(0, { retryAfterMs: 120_000 })).toBe(60_000);
  });

  it("retryAfterMs of exactly maxDelay is returned unchanged", () => {
    const policy = new AdaptiveRetryPolicy({
      baseDelayMs: 1000,
      maxDelayMs: 60_000,
    });
    expect(policy.getDelay(0, { retryAfterMs: 60_000 })).toBe(60_000);
  });

  it("retryAfterMs=0 falls back to calculated backoff (zero is falsy guard)", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const policy = new AdaptiveRetryPolicy({
      baseDelayMs: 1000,
      maxDelayMs: 60_000,
    });
    // retryAfterMs=0 is NOT > 0, so normal backoff applies
    // attempt 2: window = 4000; delay = 0.5 * 4000 = 2000
    expect(policy.getDelay(2, { retryAfterMs: 0 })).toBe(2000);
  });

  it("retryAfterMs=null falls back to calculated backoff", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const policy = new AdaptiveRetryPolicy({
      baseDelayMs: 1000,
      maxDelayMs: 60_000,
    });
    expect(policy.getDelay(2, { retryAfterMs: undefined })).toBe(2000);
  });

  it("custom baseDelayMs is respected", () => {
    vi.spyOn(Math, "random").mockReturnValue(1);
    const policy = new AdaptiveRetryPolicy({
      baseDelayMs: 500,
      maxDelayMs: 60_000,
    });
    // attempt 1: exponential = 500 * 2 = 1000; window = 1000; delay = 1 * 1000 = 1000
    expect(policy.getDelay(1)).toBe(1000);
  });

  it("custom maxDelayMs is respected as the cap", () => {
    vi.spyOn(Math, "random").mockReturnValue(1);
    const policy = new AdaptiveRetryPolicy({
      baseDelayMs: 1000,
      maxDelayMs: 3000,
    });
    // attempt 5: exponential = 32000 > cap 3000; window = 3000; delay = 3000
    expect(policy.getDelay(5)).toBe(3000);
  });
});

// ---------------------------------------------------------------------------
// AdaptiveRetryPolicy.isRetryable — string reasons
// ---------------------------------------------------------------------------

describe("AdaptiveRetryPolicy.isRetryable — string reasons", () => {
  const policy = new AdaptiveRetryPolicy();

  it('"network_error" is retryable', () => {
    expect(policy.isRetryable("network_error")).toBe(true);
  });

  it('"timeout" is retryable', () => {
    expect(policy.isRetryable("timeout")).toBe(true);
  });

  it('"server_error" is retryable', () => {
    expect(policy.isRetryable("server_error")).toBe(true);
  });

  it('"access_revoked" is NOT retryable', () => {
    expect(policy.isRetryable("access_revoked")).toBe(false);
  });

  it('"validation_error" is NOT retryable', () => {
    expect(policy.isRetryable("validation_error")).toBe(false);
  });

  it('"forbidden" is NOT retryable', () => {
    expect(policy.isRetryable("forbidden")).toBe(false);
  });

  it('"hlc_conflict" is NOT retryable', () => {
    expect(policy.isRetryable("hlc_conflict")).toBe(false);
  });

  it('"partial_hlc_conflict" is NOT retryable', () => {
    expect(policy.isRetryable("partial_hlc_conflict")).toBe(false);
  });

  it('"invalid_entity_type" is NOT retryable', () => {
    expect(policy.isRetryable("invalid_entity_type")).toBe(false);
  });

  it("empty string is retryable (not in non-retryable set)", () => {
    expect(policy.isRetryable("")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AdaptiveRetryPolicy.isRetryable — Error objects
// ---------------------------------------------------------------------------

describe("AdaptiveRetryPolicy.isRetryable — Error objects", () => {
  const policy = new AdaptiveRetryPolicy();

  it("TypeError (fetch failure) is retryable via isNetworkError", () => {
    const err = new TypeError("Failed to fetch");
    expect(policy.isRetryable(err)).toBe(true);
  });

  it('Error with "network" in message is retryable', () => {
    expect(policy.isRetryable(new Error("network connection dropped"))).toBe(
      true
    );
  });

  it('Error with "fetch" in message is retryable', () => {
    expect(policy.isRetryable(new Error("fetch aborted unexpectedly"))).toBe(
      true
    );
  });

  it('Error with "econnrefused" in message is retryable', () => {
    expect(
      policy.isRetryable(new Error("connect ECONNREFUSED 127.0.0.1:443"))
    ).toBe(true);
  });

  it('Error with "etimedout" in message is retryable', () => {
    expect(policy.isRetryable(new Error("connect ETIMEDOUT"))).toBe(true);
  });

  it('Error with "socket" in message is retryable', () => {
    expect(policy.isRetryable(new Error("socket hang up"))).toBe(true);
  });

  it("Error with embedded 500 status code is retryable", () => {
    expect(
      policy.isRetryable(new Error("Request failed with status 500"))
    ).toBe(true);
  });

  it("Error with embedded 503 status code is retryable", () => {
    expect(policy.isRetryable(new Error("upstream error 503"))).toBe(true);
  });

  it("Error with embedded 429 status code is retryable", () => {
    expect(policy.isRetryable(new Error("rate limited 429"))).toBe(true);
  });

  it("Error with embedded 400 status code is NOT retryable", () => {
    expect(policy.isRetryable(new Error("bad request 400"))).toBe(false);
  });

  it("Error with embedded 403 status code is NOT retryable", () => {
    expect(policy.isRetryable(new Error("forbidden 403"))).toBe(false);
  });

  it("Error with embedded 404 status code is NOT retryable", () => {
    expect(policy.isRetryable(new Error("not found 404"))).toBe(false);
  });

  it('Error whose message contains "access_revoked" is NOT retryable', () => {
    expect(policy.isRetryable(new Error("rejected: access_revoked"))).toBe(
      false
    );
  });

  it('Error whose message contains "validation_error" is NOT retryable', () => {
    expect(policy.isRetryable(new Error("rejected: validation_error"))).toBe(
      false
    );
  });

  it('Error whose message contains "forbidden" is NOT retryable', () => {
    expect(policy.isRetryable(new Error("operation forbidden by policy"))).toBe(
      false
    );
  });

  it('Error whose message contains "hlc_conflict" is NOT retryable', () => {
    expect(policy.isRetryable(new Error("push rejected: hlc_conflict"))).toBe(
      false
    );
  });

  it('Error whose message contains "invalid_entity_type" is NOT retryable', () => {
    expect(
      policy.isRetryable(new Error("push rejected: invalid_entity_type"))
    ).toBe(false);
  });

  it("generic Error with no special message is retryable (fail-open)", () => {
    expect(policy.isRetryable(new Error("something went wrong"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AdaptiveRetryPolicy.isRetryable — objects with statusCode / status
// ---------------------------------------------------------------------------

describe("AdaptiveRetryPolicy.isRetryable — objects with statusCode/status", () => {
  const policy = new AdaptiveRetryPolicy();

  it("statusCode 429 is retryable", () => {
    expect(policy.isRetryable({ statusCode: 429 })).toBe(true);
  });

  it("statusCode 500 is retryable", () => {
    expect(policy.isRetryable({ statusCode: 500 })).toBe(true);
  });

  it("statusCode 503 is retryable", () => {
    expect(policy.isRetryable({ statusCode: 503 })).toBe(true);
  });

  it("statusCode 400 is NOT retryable", () => {
    expect(policy.isRetryable({ statusCode: 400 })).toBe(false);
  });

  it("statusCode 401 is NOT retryable", () => {
    expect(policy.isRetryable({ statusCode: 401 })).toBe(false);
  });

  it("statusCode 403 is NOT retryable", () => {
    expect(policy.isRetryable({ statusCode: 403 })).toBe(false);
  });

  it("statusCode 404 is NOT retryable", () => {
    expect(policy.isRetryable({ statusCode: 404 })).toBe(false);
  });

  it("statusCode 422 is NOT retryable", () => {
    expect(policy.isRetryable({ statusCode: 422 })).toBe(false);
  });

  it("statusCode 499 (boundary) is NOT retryable", () => {
    expect(policy.isRetryable({ statusCode: 499 })).toBe(false);
  });

  it("statusCode 200 is retryable (not a 4xx error)", () => {
    expect(policy.isRetryable({ statusCode: 200 })).toBe(true);
  });

  it("status (alternate key) 500 is retryable", () => {
    expect(policy.isRetryable({ status: 500 })).toBe(true);
  });

  it("status 429 is retryable", () => {
    expect(policy.isRetryable({ status: 429 })).toBe(true);
  });

  it("status 404 is NOT retryable", () => {
    expect(policy.isRetryable({ status: 404 })).toBe(false);
  });

  it("statusCode takes precedence over status when both present", () => {
    // statusCode wins because it is checked first
    expect(policy.isRetryable({ statusCode: 200, status: 404 })).toBe(true);
  });

  it("object with string reason access_revoked is NOT retryable", () => {
    expect(policy.isRetryable({ reason: "access_revoked" })).toBe(false);
  });

  it("object with string reason validation_error is NOT retryable", () => {
    expect(policy.isRetryable({ reason: "validation_error" })).toBe(false);
  });

  it("object with string reason hlc_conflict is NOT retryable", () => {
    expect(policy.isRetryable({ reason: "hlc_conflict" })).toBe(false);
  });

  it("object with string reason invalid_entity_type is NOT retryable", () => {
    expect(policy.isRetryable({ reason: "invalid_entity_type" })).toBe(false);
  });

  it("object with string reason network_error is retryable", () => {
    expect(policy.isRetryable({ reason: "network_error" })).toBe(true);
  });

  it("object with no statusCode and no reason is retryable (fail-open)", () => {
    expect(policy.isRetryable({ someField: "value" })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AdaptiveRetryPolicy.isRetryable — unknown / primitive types
// ---------------------------------------------------------------------------

describe("AdaptiveRetryPolicy.isRetryable — unknown types (fail-open)", () => {
  const policy = new AdaptiveRetryPolicy();

  it("null is retryable", () => {
    expect(policy.isRetryable(null)).toBe(true);
  });

  it("undefined is retryable", () => {
    expect(policy.isRetryable(undefined)).toBe(true);
  });

  it("number is retryable", () => {
    expect(policy.isRetryable(42)).toBe(true);
  });

  it("boolean false is retryable", () => {
    expect(policy.isRetryable(false)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Constructor defaults
// ---------------------------------------------------------------------------

describe("AdaptiveRetryPolicy constructor defaults", () => {
  it("maxAttempts defaults to 5", () => {
    const policy = new AdaptiveRetryPolicy();
    expect(policy.maxAttempts).toBe(5);
  });

  it("default baseDelayMs is 1000 (attempt 0, random=1 gives <= 1000)", () => {
    vi.spyOn(Math, "random").mockReturnValue(1);
    const policy = new AdaptiveRetryPolicy();
    // window = min(maxDelay, 1000 * 2^0) = 1000; delay = 1 * 1000 = 1000
    expect(policy.getDelay(0)).toBe(1000);
    vi.restoreAllMocks();
  });

  it("default maxDelayMs is 60000 (attempt 20, random=1 gives exactly 60000)", () => {
    vi.spyOn(Math, "random").mockReturnValue(1);
    const policy = new AdaptiveRetryPolicy();
    expect(policy.getDelay(20)).toBe(60_000);
    vi.restoreAllMocks();
  });

  it("custom maxAttempts is stored", () => {
    const policy = new AdaptiveRetryPolicy({ maxAttempts: 10 });
    expect(policy.maxAttempts).toBe(10);
  });

  it("all three options can be overridden independently", () => {
    vi.spyOn(Math, "random").mockReturnValue(1);
    const policy = new AdaptiveRetryPolicy({
      baseDelayMs: 200,
      maxDelayMs: 5000,
      maxAttempts: 3,
    });
    expect(policy.maxAttempts).toBe(3);
    // attempt 0: window = min(5000, 200) = 200; delay = 200
    expect(policy.getDelay(0)).toBe(200);
    // attempt 10: window = min(5000, huge) = 5000; delay = 5000
    expect(policy.getDelay(10)).toBe(5000);
    vi.restoreAllMocks();
  });
});

// ---------------------------------------------------------------------------
// shouldRetry — respects maxAttempts
// ---------------------------------------------------------------------------

describe("shouldRetry via maxAttempts", () => {
  it("attempt < maxAttempts with retryable error should retry", () => {
    const policy = new AdaptiveRetryPolicy({ maxAttempts: 5 });
    // The policy exposes maxAttempts; callers use it as: attempt < maxAttempts
    expect(4 < policy.maxAttempts).toBe(true);
    expect(policy.isRetryable("network_error")).toBe(true);
  });

  it("attempt equal to maxAttempts should NOT retry", () => {
    const policy = new AdaptiveRetryPolicy({ maxAttempts: 5 });
    expect(5 < policy.maxAttempts).toBe(false);
  });

  it("attempt 0 with retryable error should retry", () => {
    const policy = new AdaptiveRetryPolicy({ maxAttempts: 5 });
    expect(0 < policy.maxAttempts).toBe(true);
    expect(policy.isRetryable("network_error")).toBe(true);
  });

  it("attempt 0 with non-retryable error should NOT retry regardless of maxAttempts", () => {
    const policy = new AdaptiveRetryPolicy({ maxAttempts: 5 });
    expect(policy.isRetryable("access_revoked")).toBe(false);
  });

  it("maxAttempts=1 means only a single attempt (attempt 0 retries, attempt 1 does not)", () => {
    const policy = new AdaptiveRetryPolicy({ maxAttempts: 1 });
    expect(0 < policy.maxAttempts).toBe(true);
    expect(1 < policy.maxAttempts).toBe(false);
  });

  it("maxAttempts=0 means no retries at all", () => {
    const policy = new AdaptiveRetryPolicy({ maxAttempts: 0 });
    expect(0 < policy.maxAttempts).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// defaultRetryPolicy singleton
// ---------------------------------------------------------------------------

describe("defaultRetryPolicy singleton", () => {
  it("is an instance of AdaptiveRetryPolicy", () => {
    expect(defaultRetryPolicy).toBeInstanceOf(AdaptiveRetryPolicy);
  });

  it("has maxAttempts of 5", () => {
    expect(defaultRetryPolicy.maxAttempts).toBe(5);
  });

  it("classifies network_error as retryable", () => {
    expect(defaultRetryPolicy.isRetryable("network_error")).toBe(true);
  });

  it("classifies access_revoked as NOT retryable", () => {
    expect(defaultRetryPolicy.isRetryable("access_revoked")).toBe(false);
  });

  it("getDelay returns a non-negative number", () => {
    const delay = defaultRetryPolicy.getDelay(1);
    expect(delay).toBeGreaterThanOrEqual(0);
  });
});
