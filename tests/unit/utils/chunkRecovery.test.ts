import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { shouldRecoverFromChunkError } from "~/utils/browserCache";

const RECOVERY_KEY = "peaky:chunk-recovery-attempted-at";

describe("shouldRecoverFromChunkError", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-30T14:00:00.000Z"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("permits the first cache-safe reload after a chunk failure", () => {
    expect(shouldRecoverFromChunkError()).toBe(true);
    expect(JSON.parse(localStorage.getItem(RECOVERY_KEY) ?? "")).toEqual({
      attempts: 1,
      startedAt: Date.now(),
    });
  });

  it("permits one follow-up reload before preventing a loop", () => {
    expect(shouldRecoverFromChunkError()).toBe(true);
    expect(shouldRecoverFromChunkError()).toBe(true);
    expect(shouldRecoverFromChunkError()).toBe(false);
  });

  it("permits recovery when the stored cooldown timestamp is malformed", () => {
    localStorage.setItem(RECOVERY_KEY, "not-a-timestamp");

    expect(shouldRecoverFromChunkError()).toBe(true);
    expect(JSON.parse(localStorage.getItem(RECOVERY_KEY) ?? "")).toEqual({
      attempts: 1,
      startedAt: Date.now(),
    });
  });

  it("does not escape when browser storage is unavailable", () => {
    vi.spyOn(localStorage, "getItem").mockImplementation(() => {
      throw new Error("storage unavailable");
    });

    expect(shouldRecoverFromChunkError()).toBe(false);
  });

  it("does not escape when browser storage cannot record recovery", () => {
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("storage unavailable");
    });

    expect(shouldRecoverFromChunkError()).toBe(false);
  });

  it("permits recovery for a later deployment failure", () => {
    localStorage.setItem(RECOVERY_KEY, String(Date.now() - 60_001));

    expect(shouldRecoverFromChunkError()).toBe(true);
  });

  it("permits one follow-up reload for a client with the legacy timestamp", () => {
    localStorage.setItem(RECOVERY_KEY, String(Date.now()));

    expect(shouldRecoverFromChunkError()).toBe(true);
    expect(shouldRecoverFromChunkError()).toBe(false);
  });
});
