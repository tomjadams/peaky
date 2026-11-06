import { beforeEach, describe, expect, it, vi } from "vitest";

const withDatabase = vi.fn();

// events table stub — only the columns accessed by fetchLocalAdminEvents
const events = {
  time: "time",
  entityId: "entityId",
  eventType: "eventType",
};

vi.mock("~/local-db", () => ({
  withDatabase,
  desc: vi.fn(),
  localOutbox: {
    createdAt: "createdAt",
  },
  events,
}));

describe("local admin events", () => {
  const mockRows = vi.fn();

  beforeEach(() => {
    withDatabase.mockReset();
    mockRows.mockReset();

    withDatabase.mockImplementation(async (callback) => {
      return callback({
        select: () => ({
          from: (table: { time?: string }) => {
            // events uses .orderBy().limit(); localOutbox uses .orderBy() directly.
            // Distinguish by the presence of a `time` column on the table stub.
            const isEventsTable = table === events;
            return {
              orderBy: () => {
                if (isEventsTable) {
                  // events query always returns empty in outbox-focused tests
                  return { limit: () => [] };
                }
                // localOutbox query — return the test rows
                return mockRows();
              },
            };
          },
        }),
      });
    });
  });

  it("maps pending local review creates into admin events", async () => {
    // With the payload→fields migration, pending creates surface from the
    // events table (commit() writes rich domain events there) not the outbox
    // (which now only stores field-level HLC data for sync transport).
    withDatabase.mockImplementation(async (callback) => {
      return callback({
        select: () => ({
          from: (table: { time?: string }) => {
            const isEventsTable = table === events;
            return {
              orderBy: () => {
                if (isEventsTable) {
                  return {
                    limit: () => [
                      {
                        id: "evt-001",
                        specversion: "1.0",
                        dataschema: null,
                        reviewId: "review_123",
                        eventType: "ReviewCreated.v1",
                        actorType: "user",
                        actorId: "current-user",
                        clientId: null,
                        data: JSON.stringify({
                          name: "Offline Review",
                          subjectId: "product_abc",
                        }),
                        time: "2026-03-19T10:00:00.000Z",
                        hlc: null,
                        status: "pending",
                        synced_at: null,
                        source: "peaky.client",
                        entityType: "review",
                        entityId: "review_123",
                      },
                    ],
                  };
                }
                // outbox returns empty — no longer carries payload metadata
                return [];
              },
            };
          },
        }),
      });
    });

    const { fetchLocalAdminEvents } =
      await import("../../../app/admin/localEvents");
    const adminEvents = await fetchLocalAdminEvents();

    expect(adminEvents).toEqual([
      expect.objectContaining({
        action: "ReviewCreated.v1",
        source: "peaky.client",
        status: "pending",
        subjectName: "Offline Review",
      }),
    ]);
  });

  it("omits synced local creates once they are no longer pending", async () => {
    mockRows.mockReturnValue([
      {
        id: "outbox-002",
        actorId: "current-user",
        entityType: "review",
        entityId: "review_456",
        operation: "create",
        fields: JSON.stringify({
          id: "review_456",
          subjectId: "team-customer-portal",
          name: "Synced Review",
          templateIds: ["template-001"],
        }),
        createdAt: "2026-03-19T11:00:00.000Z",
        updatedAt: "2026-03-19T11:00:00.000Z",
        status: "synced",
        retryCount: 0,
        lastError: null,
        syncedAt: "2026-03-19T11:05:00.000Z",
      },
    ]);

    const { fetchLocalAdminEvents } =
      await import("../../../app/admin/localEvents");
    const adminEvents = await fetchLocalAdminEvents();

    expect(adminEvents).toEqual([]);
  });

  it("maps failed local creates into failed admin events", async () => {
    mockRows.mockReturnValue([
      {
        id: "outbox-003",
        actorId: "current-user",
        entityType: "product",
        entityId: "product_local_1",
        operation: "create",
        fields: JSON.stringify({
          id: "product_local_1",
          name: "Offline Product",
        }),
        createdAt: "2026-03-19T12:00:00.000Z",
        updatedAt: "2026-03-19T12:00:00.000Z",
        status: "failed",
        retryCount: 2,
        lastError: "sync failed",
        syncedAt: null,
      },
    ]);

    const { fetchLocalAdminEvents } =
      await import("../../../app/admin/localEvents");
    const adminEvents = await fetchLocalAdminEvents();

    expect(adminEvents).toEqual([
      expect.objectContaining({
        action: "ProductCreated.v1",
        status: "failed",
      }),
    ]);
  });

  it("ignores malformed payloads that cannot produce an event", async () => {
    mockRows.mockReturnValue([
      {
        id: "outbox-004",
        actorId: "current-user",
        entityType: "review",
        entityId: "review_789",
        operation: "create",
        fields: "{not-valid-json}",
        createdAt: "2026-03-19T13:00:00.000Z",
        updatedAt: "2026-03-19T13:00:00.000Z",
        status: "pending",
        retryCount: 0,
        lastError: null,
        syncedAt: null,
      },
    ]);

    const { fetchLocalAdminEvents } =
      await import("../../../app/admin/localEvents");
    const adminEvents = await fetchLocalAdminEvents();

    expect(adminEvents).toEqual([]);
  });
});
