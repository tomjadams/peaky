import { beforeEach, expect, it, vi } from "vitest";
import type * as LocalDb from "~/local-db";
import { AttachmentMutations } from "~/services/entity/AttachmentMutations";

vi.mock("~/local-db", async (importOriginal) => {
  const actual = await importOriginal<typeof LocalDb>();
  return {
    ...actual,
    nowISO: vi.fn(() => "2026-03-26T10:00:00.000Z"),
    createUuidV7: vi.fn(() => "att-uuid-1"),
    withDatabase: vi.fn(),
    firstOrNull: actual.firstOrNull,
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
    draft: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue({ eventId: "evt_test" }),
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

let attachmentMutations: AttachmentMutations;
let localMutationCommit: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  vi.clearAllMocks();
  hlcState.counter = 0;
  attachmentMutations = new AttachmentMutations();
  const { localMutation } = await import("~/services/local-mutation");
  localMutationCommit = vi.mocked(localMutation.commit);
});

it("create() sends all handler-expected fields in outbox", async () => {
  await attachmentMutations.create("review-1", "pillar", "pillar-1", {
    name: "report.pdf",
    type: "application/pdf",
    size: 4096,
  });

  expect(localMutationCommit).toHaveBeenCalledOnce();
  const { outbox } = localMutationCommit.mock.calls[0]![0] as {
    outbox: { fields: { name: string; value: unknown }[] };
  };

  const fieldNames = outbox.fields.map((f) => f.name);
  // Every field AttachmentHandler reads via toFieldMap
  expect(fieldNames).toContain("reviewId");
  expect(fieldNames).toContain("scopeType");
  expect(fieldNames).toContain("scopeId");
  expect(fieldNames).toContain("filename");
  expect(fieldNames).toContain("objectKey");
  expect(fieldNames).toContain("mimeType");
  expect(fieldNames).toContain("size");
});

it("create() stamps all fields with the same HLC (atomic)", async () => {
  await attachmentMutations.create("review-1", "question", "q-1", {
    name: "screenshot.png",
    type: "image/png",
    size: 1024,
  });

  const { outbox } = localMutationCommit.mock.calls[0]![0] as {
    outbox: { fields: { name: string; hlc: string }[] };
  };

  expect(outbox.fields.length).toBeGreaterThanOrEqual(7);
  // create() calls clock.now() once and shares the result — atomic stamping.
  const hlcs = new Set(outbox.fields.map((f) => f.hlc));
  expect(hlcs.size).toBe(1);
  for (const field of outbox.fields) {
    expect(field.hlc).toMatch(/^\d+:\d{4}:.+$/);
  }
});

it("create() throws if reviewId is missing", async () => {
  await expect(
    attachmentMutations.create("", "pillar", "p-1", {
      name: "f.txt",
      type: "text/plain",
      size: 10,
    })
  ).rejects.toThrow("reviewId is required");
});

it("delete() uses operation delete with empty fields", async () => {
  // delete() checks for existing row first via withDatabase
  const { withDatabase } = await import("~/local-db");
  vi.mocked(withDatabase).mockResolvedValueOnce([
    {
      id: "att-1",
      reviewId: "review-1",
      scopeType: "pillar",
      scopeId: "pillar-1",
      filename: "file.txt",
      objectKey: "key",
      mimeType: "text/plain",
      size: 10,
      createdBy: "user-1",
      createdByName: "User",
      createdAt: "2026-01-01T00:00:00Z",
    },
  ] as never);

  await attachmentMutations.delete("review-1", "att-1");

  expect(localMutationCommit).toHaveBeenCalledOnce();
  const { outbox } = localMutationCommit.mock.calls[0]![0] as {
    outbox: { operation: string; fields: unknown[] };
  };

  expect(outbox.operation).toBe("delete");
  expect(outbox.fields).toEqual([]);
});
