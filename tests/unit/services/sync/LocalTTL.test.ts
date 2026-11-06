/**
 * Tests for LocalTTL sweep.
 *
 * Verifies: only rows older than TTL cutoff are deleted, rows within TTL
 * are preserved, and the configurable TTL value is respected.
 */
import { beforeEach, expect, it, vi } from "vitest";

// ── Drizzle table stubs ───────────────────────────────────────────────────

vi.mock("#shared/db/schema", () => ({
  events: { _: { name: "events" }, time: "time" },
  fieldVersionEvents: {
    _: { name: "field_version_events" },
    updatedAt: "updated_at",
  },
}));

// ── Drizzle operator stub ─────────────────────────────────────────────────

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    lt: vi.fn((col: unknown, val: unknown) => ({ lt: { col, val } })),
  };
});

// ── DB mock ───────────────────────────────────────────────────────────────

const deleteMock = vi.fn().mockReturnValue({
  where: vi.fn().mockResolvedValue({}),
});

vi.mock("~/local-db", () => ({
  getDatabase: vi.fn().mockResolvedValue({
    delete: deleteMock,
  }),
  isLocalDatabaseReady: vi.fn(() => true),
}));

beforeEach(() => {
  vi.clearAllMocks();
  deleteMock.mockReturnValue({ where: vi.fn().mockResolvedValue({}) });
});

it("sweepLocalTTL calls delete on events and field_version_events", async () => {
  const { sweepLocalTTL } =
    await import("../../../../app/services/sync/LocalTTL");
  await sweepLocalTTL();

  expect(deleteMock).toHaveBeenCalledTimes(2);
});

it("sweepLocalTTL uses default TTL of 14 days", async () => {
  const { lt } = await import("drizzle-orm");
  const { sweepLocalTTL, LOCAL_TTL_DAYS } =
    await import("../../../../app/services/sync/LocalTTL");

  const before = Date.now();
  await sweepLocalTTL();
  const after = Date.now();

  expect(LOCAL_TTL_DAYS).toBe(14);
  const ltCalls = vi.mocked(lt).mock.calls;
  const cutoffArg = ltCalls[0]?.[1] as string;
  const cutoff = new Date(cutoffArg).getTime();
  const expectedMin = before - 14 * 24 * 60 * 60 * 1000;
  const expectedMax = after - 14 * 24 * 60 * 60 * 1000;
  expect(cutoff).toBeGreaterThanOrEqual(expectedMin);
  expect(cutoff).toBeLessThanOrEqual(expectedMax);
});

it("sweepLocalTTL respects a custom ttlDays argument", async () => {
  const { lt } = await import("drizzle-orm");
  const { sweepLocalTTL } =
    await import("../../../../app/services/sync/LocalTTL");

  const before = Date.now();
  await sweepLocalTTL(7);
  const after = Date.now();

  const ltCalls = vi.mocked(lt).mock.calls;
  const cutoffArg = ltCalls[0]?.[1] as string;
  const cutoff = new Date(cutoffArg).getTime();
  const expectedMin = before - 7 * 24 * 60 * 60 * 1000;
  const expectedMax = after - 7 * 24 * 60 * 60 * 1000;
  expect(cutoff).toBeGreaterThanOrEqual(expectedMin);
  expect(cutoff).toBeLessThanOrEqual(expectedMax);
});

it("sweepLocalTTL clamps ttlDays to a minimum of 1", async () => {
  const { lt } = await import("drizzle-orm");
  const { sweepLocalTTL } =
    await import("../../../../app/services/sync/LocalTTL");

  const before = Date.now();
  await sweepLocalTTL(0);
  const after = Date.now();

  const ltCalls = vi.mocked(lt).mock.calls;
  const cutoffArg = ltCalls[0]?.[1] as string;
  const cutoff = new Date(cutoffArg).getTime();
  const expectedMin = before - 1 * 24 * 60 * 60 * 1000;
  const expectedMax = after - 1 * 24 * 60 * 60 * 1000;
  expect(cutoff).toBeGreaterThanOrEqual(expectedMin);
  expect(cutoff).toBeLessThanOrEqual(expectedMax);
});

it("sweepLocalTTL returns early when DB is not ready", async () => {
  const { isLocalDatabaseReady } = await import("~/local-db");
  vi.mocked(isLocalDatabaseReady).mockReturnValue(false);

  const { sweepLocalTTL } =
    await import("../../../../app/services/sync/LocalTTL");
  const result = await sweepLocalTTL();

  expect(result).toEqual({ eventsDeleted: 0, fieldVersionsDeleted: 0 });
  expect(deleteMock).not.toHaveBeenCalled();
});
