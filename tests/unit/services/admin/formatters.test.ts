import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  compareAdminEvents,
  formatEventTime,
  matchesAdminEventQuery,
} from "~/admin/formatters";
import type { AdminEventRecord } from "~/admin/events";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(
  overrides: Partial<AdminEventRecord> = {}
): AdminEventRecord {
  return {
    id: "evt-001",
    category: "product",
    action: "product.created.v1",
    actionLabel: "Product Created",
    subjectType: "product",
    subjectTypeLabel: "Product",
    subjectId: "prod-001",
    subjectName: "My Product",
    actorId: "user-001",
    actorName: "Alice",
    actorRoles: ["admin"],
    actorType: "user",
    source: "peaky.client",
    status: "synced",
    summary: "Alice created the product My Product",
    details: {},
    time: "2026-01-15T10:00:00.000Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// formatEventTime
// ---------------------------------------------------------------------------

describe("formatEventTime()", () => {
  // Pin "now" to a fixed instant so all relative calculations are deterministic.
  const NOW = new Date("2026-04-01T12:00:00.000Z").getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "just now" for a timestamp less than 1 minute ago', () => {
    const ts = new Date(NOW - 30 * 1000).toISOString(); // 30 s ago
    expect(formatEventTime(ts)).toBe("just now");
  });

  it('returns "just now" for a timestamp at exactly now', () => {
    const ts = new Date(NOW).toISOString();
    expect(formatEventTime(ts)).toBe("just now");
  });

  it('returns "Xm ago" for a timestamp 1 minute ago', () => {
    const ts = new Date(NOW - 1 * 60 * 1000).toISOString();
    expect(formatEventTime(ts)).toBe("1m ago");
  });

  it('returns "Xm ago" for a timestamp 45 minutes ago', () => {
    const ts = new Date(NOW - 45 * 60 * 1000).toISOString();
    expect(formatEventTime(ts)).toBe("45m ago");
  });

  it('returns "Xm ago" for a timestamp 59 minutes ago', () => {
    const ts = new Date(NOW - 59 * 60 * 1000).toISOString();
    expect(formatEventTime(ts)).toBe("59m ago");
  });

  it('returns "Xh ago" for a timestamp 1 hour ago', () => {
    const ts = new Date(NOW - 1 * 60 * 60 * 1000).toISOString();
    expect(formatEventTime(ts)).toBe("1h ago");
  });

  it('returns "Xh ago" for a timestamp 5 hours ago', () => {
    const ts = new Date(NOW - 5 * 60 * 60 * 1000).toISOString();
    expect(formatEventTime(ts)).toBe("5h ago");
  });

  it('returns "Xh ago" for a timestamp 23 hours ago', () => {
    const ts = new Date(NOW - 23 * 60 * 60 * 1000).toISOString();
    expect(formatEventTime(ts)).toBe("23h ago");
  });

  it('returns "Xd ago" for a timestamp 1 day ago', () => {
    const ts = new Date(NOW - 1 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatEventTime(ts)).toBe("1d ago");
  });

  it('returns "Xd ago" for a timestamp 15 days ago', () => {
    const ts = new Date(NOW - 15 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatEventTime(ts)).toBe("15d ago");
  });

  it('returns "Xd ago" for a timestamp 29 days ago', () => {
    const ts = new Date(NOW - 29 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatEventTime(ts)).toBe("29d ago");
  });

  it('returns "Xmo ago" for a timestamp 1 month (30 days) ago', () => {
    const ts = new Date(NOW - 30 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatEventTime(ts)).toBe("1mo ago");
  });

  it('returns "Xmo ago" for a timestamp 6 months ago', () => {
    const ts = new Date(NOW - 6 * 30 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatEventTime(ts)).toBe("6mo ago");
  });

  it('returns "Xmo ago" for a timestamp 11 months ago', () => {
    const ts = new Date(NOW - 11 * 30 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatEventTime(ts)).toBe("11mo ago");
  });

  it('returns "Xy ago" for a timestamp 1 year (365 days) ago', () => {
    const ts = new Date(NOW - 365 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatEventTime(ts)).toBe("1y ago");
  });

  it('returns "Xy ago" for a timestamp 3 years ago', () => {
    const ts = new Date(NOW - 3 * 365 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatEventTime(ts)).toBe("3y ago");
  });

  it('returns "—" for an invalid date string', () => {
    expect(formatEventTime("not-a-date")).toBe("—");
  });

  it('returns "—" for an empty string', () => {
    expect(formatEventTime("")).toBe("—");
  });
});

// ---------------------------------------------------------------------------
// compareAdminEvents
// ---------------------------------------------------------------------------

describe("compareAdminEvents()", () => {
  const eventA = makeEvent({
    actionLabel: "Alpha Action",
    subjectName: "Alpha Subject",
    actorName: "Alice",
    status: "pending",
    time: "2026-01-01T00:00:00.000Z",
  });

  const eventB = makeEvent({
    id: "evt-002",
    actionLabel: "Beta Action",
    subjectName: "Beta Subject",
    actorName: "Bob",
    status: "synced",
    time: "2026-06-01T00:00:00.000Z",
  });

  // actionLabel
  it("sorts by actionLabel ascending: A < B", () => {
    expect(
      compareAdminEvents(eventA, eventB, "actionLabel", "asc")
    ).toBeLessThan(0);
  });

  it("sorts by actionLabel descending: A > B", () => {
    expect(
      compareAdminEvents(eventA, eventB, "actionLabel", "desc")
    ).toBeGreaterThan(0);
  });

  it("sorts by actionLabel ascending: B > A", () => {
    expect(
      compareAdminEvents(eventB, eventA, "actionLabel", "asc")
    ).toBeGreaterThan(0);
  });

  // subjectName
  it("sorts by subjectName ascending: A < B", () => {
    expect(
      compareAdminEvents(eventA, eventB, "subjectName", "asc")
    ).toBeLessThan(0);
  });

  it("sorts by subjectName descending: B is first", () => {
    expect(
      compareAdminEvents(eventA, eventB, "subjectName", "desc")
    ).toBeGreaterThan(0);
  });

  // actorName
  it("sorts by actorName ascending: Alice < Bob", () => {
    expect(compareAdminEvents(eventA, eventB, "actorName", "asc")).toBeLessThan(
      0
    );
  });

  it("sorts by actorName descending: Bob comes first", () => {
    expect(
      compareAdminEvents(eventA, eventB, "actorName", "desc")
    ).toBeGreaterThan(0);
  });

  // time
  it("sorts by time ascending: earlier date is first", () => {
    expect(compareAdminEvents(eventA, eventB, "time", "asc")).toBeLessThan(0);
  });

  it("sorts by time descending: later date is first", () => {
    expect(compareAdminEvents(eventA, eventB, "time", "desc")).toBeGreaterThan(
      0
    );
  });

  // status
  it("sorts by status ascending (lexicographic): pending < synced", () => {
    expect(compareAdminEvents(eventA, eventB, "status", "asc")).toBeLessThan(0);
  });

  it("sorts by status descending: synced before pending", () => {
    expect(
      compareAdminEvents(eventA, eventB, "status", "desc")
    ).toBeGreaterThan(0);
  });

  // Equal values
  it("returns 0 when both events have identical values for the column", () => {
    const twin = makeEvent({ actionLabel: "Alpha Action" });
    expect(compareAdminEvents(eventA, twin, "actionLabel", "asc")).toBe(0);
  });

  // Case-insensitive comparison
  it("compares actionLabel case-insensitively", () => {
    const lower = makeEvent({ actionLabel: "alpha action" });
    const upper = makeEvent({ actionLabel: "Alpha Action" });
    expect(compareAdminEvents(lower, upper, "actionLabel", "asc")).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// matchesAdminEventQuery
// ---------------------------------------------------------------------------

describe("matchesAdminEventQuery()", () => {
  const event = makeEvent({
    actionLabel: "Product Created",
    summary: "Alice created the product My Widget",
    subjectName: "My Widget",
    subjectId: "prod-abc-123",
    actorName: "Alice Smith",
    actorId: "user-xyz-456",
  });

  it("returns true for an empty query string", () => {
    expect(matchesAdminEventQuery(event, "")).toBe(true);
  });

  it("returns true for a whitespace-only query", () => {
    expect(matchesAdminEventQuery(event, "   ")).toBe(true);
  });

  it("matches against actionLabel (exact)", () => {
    expect(matchesAdminEventQuery(event, "Product Created")).toBe(true);
  });

  it("matches against actionLabel (partial)", () => {
    expect(matchesAdminEventQuery(event, "Product")).toBe(true);
  });

  it("matches against summary", () => {
    expect(matchesAdminEventQuery(event, "created the product")).toBe(true);
  });

  it("matches against subjectName", () => {
    expect(matchesAdminEventQuery(event, "My Widget")).toBe(true);
  });

  it("matches against subjectId", () => {
    expect(matchesAdminEventQuery(event, "prod-abc-123")).toBe(true);
  });

  it("matches against actorName", () => {
    expect(matchesAdminEventQuery(event, "Alice Smith")).toBe(true);
  });

  it("matches against actorId", () => {
    expect(matchesAdminEventQuery(event, "user-xyz-456")).toBe(true);
  });

  it("is case-insensitive for actionLabel", () => {
    expect(matchesAdminEventQuery(event, "product created")).toBe(true);
    expect(matchesAdminEventQuery(event, "PRODUCT CREATED")).toBe(true);
  });

  it("is case-insensitive for actorName", () => {
    expect(matchesAdminEventQuery(event, "alice smith")).toBe(true);
    expect(matchesAdminEventQuery(event, "ALICE")).toBe(true);
  });

  it("returns false when query matches no field", () => {
    expect(matchesAdminEventQuery(event, "nonexistent-query-xyz")).toBe(false);
  });

  it("matches partial subjectId fragment", () => {
    expect(matchesAdminEventQuery(event, "abc-123")).toBe(true);
  });

  it("does not match against fields not in the search set (e.g. source)", () => {
    // "peaky.client" is the source field — it is intentionally excluded from search
    expect(matchesAdminEventQuery(event, "peaky.client")).toBe(false);
  });
});
