import { getTableName } from "drizzle-orm";
import { beforeEach, expect, it, vi } from "vitest";
import type * as LocalDb from "~/local-db";
import { ReviewMutations } from "~/services/entity/ReviewMutations";

vi.mock("~/local-db", async (importOriginal) => {
  const actual = await importOriginal<typeof LocalDb>();
  return {
    ...actual,
    withDatabase: vi.fn(),
    generateId: vi.fn((prefix: string) => `${prefix}_test`),
    nowISO: vi.fn(() => "2026-03-26T10:00:00.000Z"),
    eq: vi.fn(),
  };
});

vi.mock("~/composables/auth/useCurrentActor", () => ({
  readPersistedActor: vi.fn().mockReturnValue({
    id: "user-001",
    name: "Test User",
    roles: ["member"],
  }),
}));

vi.mock("~/services/local-mutation", () => ({
  localMutation: {
    commit: vi.fn().mockResolvedValue({ eventId: "evt_test" }),
    draft: vi.fn().mockResolvedValue(undefined),
    replay: vi.fn().mockResolvedValue({ eventId: "evt_test" }),
  },
}));

// HLC clock — returns incrementing values so tests can distinguish per-field
// stamping (each field gets a unique HLC) from atomic stamping (all share one).
const hlcState = vi.hoisted(() => ({ counter: 0 }));
vi.mock("~/services/sync/syncClock", () => ({
  getHLCClock: vi.fn().mockReturnValue({
    now: vi.fn(
      () => `1000:${String(++hlcState.counter).padStart(4, "0")}:user-001`
    ),
  }),
  resetHLCClock: vi.fn(),
}));

vi.mock("~/services/events/createEvent", () => ({
  createEvent: vi.fn((type, entityId, data) => ({
    id: "evt_test",
    type,
    specversion: "1.0",
    source: "peaky.client",
    actorId: "user-001",
    actorType: "user",
    entityType: "review",
    entityId,
    time: "2026-03-26T10:00:00.000Z",
    data,
  })),
}));

let reviewMutations: ReviewMutations;
let withDatabase: ReturnType<typeof vi.fn>;
let localMutationCommit: ReturnType<typeof vi.fn>;
let localMutationDraft: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  vi.clearAllMocks();
  hlcState.counter = 0;
  reviewMutations = new ReviewMutations();
  const localDb = await import("~/local-db");
  withDatabase = vi.mocked(localDb.withDatabase);
  const { localMutation } = await import("~/services/local-mutation");
  localMutationCommit = vi.mocked(localMutation.commit);
  localMutationDraft = vi.mocked(localMutation.draft);
});

// ── create() ────────────────────────────────────────────────────────────────

it("create() throws if templateRevisionIds is empty", async () => {
  await expect(
    reviewMutations.create({
      subjectId: "product-1",
      name: "My Review",
      templateRevisionIds: [],
    })
  ).rejects.toThrow("At least one Template Revision is required");
});

it("create() throws if subjectId is missing", async () => {
  await expect(
    reviewMutations.create({
      subjectId: "",
      name: "My Review",
      templateRevisionIds: ["tpl-1"],
    })
  ).rejects.toThrow("subjectId is required");
});

it("create() throws if name is missing", async () => {
  await expect(
    reviewMutations.create({
      subjectId: "product-1",
      name: "",
      templateRevisionIds: ["tpl-1"],
    })
  ).rejects.toThrow("name is required");
});

it("create() routes through localMutation.commit with populated fields", async () => {
  await reviewMutations.create({
    subjectId: "product-1",
    subjectType: "product",
    name: "Valid Review",
    templateRevisionIds: ["tpl-1"],
    scope: "product",
    applicationIds: [],
    teamIds: [],
  });

  expect(localMutationCommit).toHaveBeenCalledOnce();
  const { outbox } = localMutationCommit.mock.calls[0]![0] as {
    outbox: {
      entityType: string;
      entityId: string;
      operation: string;
      fields: { name: string; value: unknown; hlc: string }[];
    };
  };
  expect(outbox.entityType).toBe("review");
  expect(outbox.operation).toBe("upsert");

  const fieldNames = outbox.fields.map((f) => f.name);
  expect(fieldNames).toEqual(["subjectId", "name", "status"]);

  const statusField = outbox.fields.find((f) => f.name === "status");
  expect(statusField?.value).toBe("draft");

  // All fields should have HLC stamps — create() uses atomic stamping
  // (one clock.now() call shared across all fields).
  const hlcs = new Set(outbox.fields.map((f) => f.hlc));
  expect(hlcs.size).toBe(1);
  for (const f of outbox.fields) {
    expect(typeof f.hlc).toBe("string");
    expect(f.hlc.length).toBeGreaterThan(0);
  }
});

it("create() persists ordered exact Revision selections without synthetic IDs", async () => {
  const inserts = new Map<string, unknown>();
  localMutationCommit.mockImplementationOnce(async ({ stateWrite }) => {
    await stateWrite({
      select() {
        return {
          from(table: Parameters<typeof getTableName>[0]) {
            return {
              where() {
                const tableName = getTableName(table);
                const rows =
                  tableName === "subjects"
                    ? [{ id: "product-1", type: "product" }]
                    : tableName === "template_revisions"
                      ? [
                          {
                            id: "revision-a",
                            templateId: "template-a",
                            status: "published",
                          },
                          {
                            id: "revision-b",
                            templateId: "template-b",
                            status: "published",
                          },
                        ]
                      : tableName === "templates"
                        ? [
                            { id: "template-a", status: "active" },
                            { id: "template-b", status: "active" },
                          ]
                        : [];
                return Object.assign(Promise.resolve(rows), {
                  limit: () => Promise.resolve(rows),
                });
              },
            };
          },
        };
      },
      insert(table: Parameters<typeof getTableName>[0]) {
        return {
          values(rows: unknown) {
            inserts.set(getTableName(table), rows);
            return Promise.resolve();
          },
        };
      },
    });
    return { eventId: "evt_test" };
  });

  await reviewMutations.create({
    subjectId: "product-1",
    subjectType: "product",
    name: "Valid Review",
    templateRevisionIds: ["revision-a", "revision-b"],
    scope: "product",
  });

  const mutation = localMutationCommit.mock.calls[0]![0] as {
    event: { data: { templateIds: string[] } };
    outbox: { fields: { name: string }[] };
  };
  expect(mutation.event.data.templateIds).toEqual(["template-a", "template-b"]);
  expect(mutation.outbox.fields.map(({ name }) => name)).toEqual([
    "subjectId",
    "name",
    "status",
  ]);
  expect(inserts.get("review_template_selections")).toEqual([
    expect.objectContaining({
      reviewId: expect.any(String),
      templateRevisionId: "revision-a",
      position: 0,
    }),
    expect.objectContaining({
      reviewId: expect.any(String),
      templateRevisionId: "revision-b",
      position: 1,
    }),
  ]);
  expect(inserts.get("review_template_selections")).not.toEqual(
    expect.arrayContaining([expect.objectContaining({ id: expect.anything() })])
  );
});

it("create() returns a review id", async () => {
  const result = await reviewMutations.create({
    subjectId: "product-1",
    subjectType: "product",
    name: "Valid Review",
    templateRevisionIds: ["tpl-1"],
    scope: "product",
    applicationIds: [],
    teamIds: [],
  });

  expect(typeof result).toBe("string");
  expect(result.length).toBeGreaterThan(0);
});

// ── update() ────────────────────────────────────────────────────────────────

it("update() routes through localMutation.draft with name field", async () => {
  await reviewMutations.update("rev-1", { name: "Renamed Review" });

  expect(localMutationDraft).toHaveBeenCalledOnce();
  const { outbox } = localMutationDraft.mock.calls[0]![0] as {
    outbox: {
      entityType: string;
      operation: string;
      fields: { name: string; value: unknown; hlc: string }[];
    };
  };
  expect(outbox.entityType).toBe("review");
  expect(outbox.operation).toBe("upsert");
  expect(outbox.fields).toHaveLength(1);
  expect(outbox.fields[0]!.name).toBe("name");
  expect(outbox.fields[0]!.value).toBe("Renamed Review");
});

it("update() routes through localMutation.draft with status field", async () => {
  await reviewMutations.update("rev-1", { status: "in-progress" });

  expect(localMutationDraft).toHaveBeenCalledOnce();
  const { outbox } = localMutationDraft.mock.calls[0]![0] as {
    outbox: { fields: { name: string; value: unknown }[] };
  };
  expect(outbox.fields).toHaveLength(1);
  expect(outbox.fields[0]!.name).toBe("status");
  expect(outbox.fields[0]!.value).toBe("in-progress");
});

it("update() sends both name and status when both change", async () => {
  await reviewMutations.update("rev-1", {
    name: "New Name",
    status: "completed",
  });

  const { outbox } = localMutationDraft.mock.calls[0]![0] as {
    outbox: { fields: { name: string; hlc: string }[] };
  };
  expect(outbox.fields).toHaveLength(2);
  const names = outbox.fields.map((f) => f.name);
  expect(names).toContain("name");
  expect(names).toContain("status");
  // update() calls clock.now() per field — per-field stamping.
  const hlcs = outbox.fields.map((f) => f.hlc);
  expect(new Set(hlcs).size).toBe(hlcs.length);
});

it("update() does nothing when no changes provided", async () => {
  await reviewMutations.update("rev-1", {});

  expect(localMutationDraft).not.toHaveBeenCalled();
});

// ── archive() ───────────────────────────────────────────────────────────────

function mockFetchReviewName(name: string) {
  withDatabase.mockImplementation(
    async (fn: (db: unknown) => Promise<unknown>) => {
      const fakeDb = {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([{ name }]),
            }),
          }),
        }),
      };
      return fn(fakeDb);
    }
  );
}

it("archive() throws if review not found", async () => {
  withDatabase.mockImplementation(
    async (fn: (db: unknown) => Promise<unknown>) => {
      const fakeDb = {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([]),
            }),
          }),
        }),
      };
      return fn(fakeDb);
    }
  );

  await expect(reviewMutations.archive("nonexistent-id")).rejects.toThrow(
    "Review not found: nonexistent-id"
  );
});

it("archive() sends status field with operation upsert", async () => {
  mockFetchReviewName("My Review");

  await reviewMutations.archive("rev-1");

  expect(localMutationCommit).toHaveBeenCalledOnce();
  const { outbox } = localMutationCommit.mock.calls[0]![0] as {
    outbox: {
      operation: string;
      fields: { name: string; value: unknown; hlc: string }[];
    };
  };
  expect(outbox.operation).toBe("upsert");
  expect(outbox.fields).toHaveLength(1);
  expect(outbox.fields[0]!.name).toBe("status");
  expect(outbox.fields[0]!.value).toBe("archived");
});

// ── restore() ───────────────────────────────────────────────────────────────

it("restore() sends status field with operation upsert", async () => {
  mockFetchReviewName("My Review");

  await reviewMutations.restore("rev-1", "in-progress");

  expect(localMutationCommit).toHaveBeenCalledOnce();
  const { outbox } = localMutationCommit.mock.calls[0]![0] as {
    outbox: {
      operation: string;
      fields: { name: string; value: unknown }[];
    };
  };
  expect(outbox.operation).toBe("upsert");
  expect(outbox.fields).toHaveLength(1);
  expect(outbox.fields[0]!.name).toBe("status");
  expect(outbox.fields[0]!.value).toBe("in-progress");
});

it("restore() normalizes 'archived' status to 'draft'", async () => {
  mockFetchReviewName("My Review");

  await reviewMutations.restore("rev-1", "archived");

  const { outbox } = localMutationCommit.mock.calls[0]![0] as {
    outbox: { fields: { name: string; value: unknown }[] };
  };
  expect(outbox.fields[0]!.name).toBe("status");
  expect(outbox.fields[0]!.value).toBe("draft");
});

it("restore() defaults to 'draft' when no status provided", async () => {
  mockFetchReviewName("My Review");

  await reviewMutations.restore("rev-1");

  const { outbox } = localMutationCommit.mock.calls[0]![0] as {
    outbox: { fields: { name: string; value: unknown }[] };
  };
  expect(outbox.fields[0]!.value).toBe("draft");
});

// ── delete() ────────────────────────────────────────────────────────────────

it("delete() throws if review not found", async () => {
  withDatabase.mockImplementation(
    async (fn: (db: unknown) => Promise<unknown>) => {
      const fakeDb = {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([]),
            }),
          }),
        }),
      };
      return fn(fakeDb);
    }
  );

  await expect(reviewMutations.delete("nonexistent-id")).rejects.toThrow(
    "Review not found: nonexistent-id"
  );
});

it("delete() uses operation delete with empty fields", async () => {
  mockFetchReviewName("Old Review");

  await reviewMutations.delete("rev-1");

  expect(localMutationCommit).toHaveBeenCalledOnce();
  const { outbox } = localMutationCommit.mock.calls[0]![0] as {
    outbox: { operation: string; fields: unknown[] };
  };
  expect(outbox.operation).toBe("delete");
  // Deletes carry no fields — slice 6 addresses delete semantics
  expect(outbox.fields).toEqual([]);
});
