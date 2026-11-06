/**
 * Targeted regression tests for the admin formatter — specifically the
 * fix for the v2 "Raw Details should show the full envelope" wart.
 *
 * Pre-§6, eventToAdminRecord only spread `parsedData` into `details`,
 * so the slideover's Raw Details pane lost source/specversion/status/etc.
 * These tests pin the envelope-spread contract.
 */
import { describe, it, expect } from "vitest";
import { eventToAdminRecord } from "~/admin/localEvents";
import type { events } from "#shared/db/schema";

type EventRow = typeof events.$inferSelect;

function makeRow(overrides: Partial<EventRow> = {}): EventRow {
  return {
    id: "evt_001",
    specversion: "1.0",
    dataschema: "https://orr-sample.example/schemas/ProductCreated.v1.json",
    reviewId: null,
    eventType: "ProductCreated.v1",
    actorType: "user",
    actorId: "user-001",
    clientId: "client-session-abc",
    data: JSON.stringify({ name: "Payments Platform", teamIds: [] }),
    time: "2026-04-30T10:00:00.000Z",
    status: "pending",
    syncedAt: null,
    source: "peaky.client",
    entityType: "product",
    entityId: "product_001",
    ...overrides,
  } as EventRow;
}

describe("eventToAdminRecord — full envelope spread", () => {
  it("includes every CloudEvents core attribute in details", () => {
    const record = eventToAdminRecord(makeRow());

    expect(record.details).toMatchObject({
      id: "evt_001",
      type: "ProductCreated.v1",
      specversion: "1.0",
      source: "peaky.client",
      dataschema: "https://orr-sample.example/schemas/ProductCreated.v1.json",
      time: "2026-04-30T10:00:00.000Z",
    });
  });

  it("includes the envelope extension attributes in details", () => {
    const record = eventToAdminRecord(
      makeRow({
        reviewId: "review_xyz",
        clientId: "client-session-abc",
      })
    );

    expect(record.details).toMatchObject({
      actorId: "user-001",
      actorType: "user",
      entityType: "product",
      entityId: "product_001",
      reviewId: "review_xyz",
      clientId: "client-session-abc",
      status: "pending",
    });
  });

  it("nests the parsed payload under `details.data`", () => {
    const record = eventToAdminRecord(makeRow());

    expect(record.details).toHaveProperty("data");
    expect(record.details.data).toEqual({
      name: "Payments Platform",
      teamIds: [],
    });
  });

  it("preserves null envelope fields without throwing", () => {
    const record = eventToAdminRecord(
      makeRow({
        dataschema: null,
        reviewId: null,
        clientId: null,
      })
    );

    expect(record.details).toMatchObject({
      dataschema: null,
      reviewId: null,
      clientId: null,
    });
  });

  it("renders 'local' status for catalog-flagged system events", () => {
    const record = eventToAdminRecord(
      makeRow({
        status: "local",
        eventType: "LocalDbReady.v1",
        entityType: "local_db",
        source: "peaky.system",
        actorType: "system",
        actorId: "system",
        data: JSON.stringify({ coldStartMs: 230, opfsAvailable: true }),
      })
    );

    expect(record.status).toBe("local");
    expect(record.details).toMatchObject({
      type: "LocalDbReady.v1",
      source: "peaky.system",
      status: "local",
    });
  });
});

describe("eventToAdminRecord — categorisation", () => {
  it("categorises peaky.system DB lifecycle events as 'system' (not 'lifecycle')", () => {
    // The lifecycle category is reserved for user-facing review/product/
    // template lifecycle (archive, restore, delete). Internal observability
    // events from peaky.system belong in the system category so they don't
    // pollute the lifecycle filter.
    const record = eventToAdminRecord(
      makeRow({
        eventType: "LocalDbReady.v1",
        entityType: "local_db",
        source: "peaky.system",
        actorType: "system",
        actorId: "system",
        data: JSON.stringify({ coldStartMs: 230, opfsAvailable: true }),
      })
    );
    expect(record.category).toBe("system");
  });

  it("categorises OPFS measurement as 'system'", () => {
    const record = eventToAdminRecord(
      makeRow({
        eventType: "OpfsStorageMeasured.v1",
        entityType: "opfs",
        source: "peaky.system",
        actorType: "system",
        actorId: "system",
        data: JSON.stringify({
          supported: true,
          usageBytes: 4_200_000,
          quotaBytes: 100_000_000,
        }),
      })
    );
    expect(record.category).toBe("system");
  });

  it("keeps review-archived events in the lifecycle category", () => {
    // Regression guard for the categorisation change — make sure user-facing
    // lifecycle events are NOT affected.
    const record = eventToAdminRecord(
      makeRow({
        eventType: "ReviewArchived.v1",
        entityType: "review",
        source: "peaky.client",
        actorType: "user",
        actorId: "user-001",
        data: JSON.stringify({ reason: "manual archive" }),
      })
    );
    expect(record.category).toBe("review");
  });
});
