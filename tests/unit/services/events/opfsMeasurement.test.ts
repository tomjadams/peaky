import { beforeEach, describe, expect, it, vi } from "vitest";
import { measureOpfs } from "~/services/events/opfsMeasurement";

// Mock local-db/client so DB_NAME is defined without initialising SQLocal.
vi.mock("~/local-db/client", () => ({ DB_NAME: "peaky-local" }));

// Mock emitSystemEvent so measureAndEmitOpfs doesn't need a real database.
vi.mock("~/services/events/emitSystemEvent", () => ({
  emitSystemEvent: vi.fn().mockResolvedValue({ eventId: "test-id" }),
}));

// ── helpers ────────────────────────────────────────────────────────────────────

/** Build a minimal navigator.storage stub. */
function makeStorage(overrides: {
  estimateResult?: { usage?: number; quota?: number };
  estimateThrows?: boolean;
  getDirectoryResult?: Record<string, number> | null; // filename → size
  getDirectoryThrows?: boolean;
  supportsGetDirectory?: boolean;
}) {
  const {
    estimateResult = { usage: 1_000_000, quota: 10_000_000 },
    estimateThrows = false,
    getDirectoryResult = null,
    getDirectoryThrows = false,
    supportsGetDirectory = true,
  } = overrides;

  const estimateFn = estimateThrows
    ? vi.fn().mockRejectedValue(new Error("estimate failed"))
    : vi.fn().mockResolvedValue(estimateResult);

  const storage: Record<string, unknown> = { estimate: estimateFn };

  if (supportsGetDirectory) {
    const getFileFn = (filename: string) => {
      const sizes = getDirectoryResult ?? {};
      if (!(filename in sizes)) throw new Error("not found");
      return Promise.resolve({ size: sizes[filename] });
    };
    const getFileHandleFn = vi.fn((name: string) =>
      getDirectoryResult !== null && name in getDirectoryResult
        ? Promise.resolve({ getFile: () => getFileFn(name) })
        : Promise.reject(new Error("not found"))
    );

    const dirHandle = { getFileHandle: getFileHandleFn };
    storage["getDirectory"] = getDirectoryThrows
      ? vi.fn().mockRejectedValue(new Error("OPFS unavailable"))
      : vi.fn().mockResolvedValue(dirHandle);
  }

  return storage;
}

function setNavigator(storage: Record<string, unknown> | undefined) {
  Object.defineProperty(globalThis, "navigator", {
    value: storage !== undefined ? { storage } : undefined,
    writable: true,
    configurable: true,
  });
}

// ── tests ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

describe("measureOpfs", () => {
  it("returns supported:false when navigator is undefined", async () => {
    Object.defineProperty(globalThis, "navigator", {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const result = await measureOpfs();

    expect(result).toEqual({
      usageBytes: null,
      quotaBytes: null,
      supported: false,
    });
  });

  it("returns supported:false when estimate is not a function", async () => {
    setNavigator({ estimate: undefined });

    const result = await measureOpfs();

    expect(result).toEqual({
      usageBytes: null,
      quotaBytes: null,
      supported: false,
    });
  });

  it("uses actual OPFS file size when getDirectory is available", async () => {
    setNavigator(
      makeStorage({
        estimateResult: { usage: 4_000_000_000, quota: 10_000_000_000 },
        getDirectoryResult: {
          "peaky-local.sqlite3": 50_000,
          "peaky-local.sqlite3-wal": 8_000,
        },
      })
    );

    const result = await measureOpfs();

    expect(result.supported).toBe(true);
    expect(result.usageBytes).toBe(58_000); // actual file sum, not the 4 GB estimate
    expect(result.quotaBytes).toBe(10_000_000_000);
  });

  it("falls back to estimate.usage when getDirectory is not supported", async () => {
    setNavigator(
      makeStorage({
        estimateResult: { usage: 4_000_000_000, quota: 10_000_000_000 },
        supportsGetDirectory: false,
      })
    );

    const result = await measureOpfs();

    expect(result.supported).toBe(true);
    expect(result.usageBytes).toBe(4_000_000_000);
    expect(result.quotaBytes).toBe(10_000_000_000);
  });

  it("falls back to estimate.usage when getDirectory throws", async () => {
    setNavigator(
      makeStorage({
        estimateResult: { usage: 2_000_000, quota: 10_000_000_000 },
        getDirectoryThrows: true,
      })
    );

    const result = await measureOpfs();

    expect(result.supported).toBe(true);
    expect(result.usageBytes).toBe(2_000_000);
  });

  it("falls back to estimate.usage when no matching OPFS file exists", async () => {
    setNavigator(
      makeStorage({
        estimateResult: { usage: 500_000, quota: 10_000_000_000 },
        getDirectoryResult: {}, // no matching files
      })
    );

    const result = await measureOpfs();

    expect(result.supported).toBe(true);
    expect(result.usageBytes).toBe(500_000);
  });

  it("includes WAL and SHM files in the total when present", async () => {
    setNavigator(
      makeStorage({
        estimateResult: { usage: 9_999_999, quota: 10_000_000_000 },
        getDirectoryResult: {
          "peaky-local.sqlite3": 100_000,
          "peaky-local.sqlite3-wal": 20_000,
          "peaky-local.sqlite3-shm": 4_096,
        },
      })
    );

    const result = await measureOpfs();

    expect(result.usageBytes).toBe(124_096);
  });

  it("returns supported:false when estimate throws", async () => {
    setNavigator(
      makeStorage({
        estimateThrows: true,
        supportsGetDirectory: false,
      })
    );

    const result = await measureOpfs();

    expect(result).toEqual({
      usageBytes: null,
      quotaBytes: null,
      supported: false,
    });
  });
});
