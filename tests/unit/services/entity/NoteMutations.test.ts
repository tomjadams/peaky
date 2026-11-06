import { beforeEach, expect, it, vi } from "vitest";
import type * as LocalDb from "~/local-db";
import { NoteMutations } from "~/services/entity/NoteMutations";

vi.mock("~/local-db", async (importOriginal) => {
  const actual = await importOriginal<typeof LocalDb>();
  return {
    ...actual,
    nowISO: vi.fn(() => "2026-03-26T10:00:00.000Z"),
  };
});

vi.mock("~/services/local-mutation", () => ({
  localMutation: {
    draft: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue({ eventId: "evt_test" }),
    replay: vi.fn().mockResolvedValue({ eventId: "evt_test" }),
  },
}));

vi.mock("~/services/sync/syncClock", () => ({
  getHLCClock: vi
    .fn()
    .mockReturnValue({ now: vi.fn().mockReturnValue("1000:0001:user-001") }),
  resetHLCClock: vi.fn(),
}));

let noteMutations: NoteMutations;
let localMutationCommit: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  vi.clearAllMocks();
  noteMutations = new NoteMutations();
  const { localMutation } = await import("~/services/local-mutation");
  localMutationCommit = vi.mocked(localMutation.commit);
});

it("save() sends only content in outbox fields (identity is in the entity ID)", async () => {
  await noteMutations.save("review-1", "pillar", "pillar-1", "my note");

  expect(localMutationCommit).toHaveBeenCalledOnce();
  const { outbox } = localMutationCommit.mock.calls[0]![0] as {
    outbox: { entityId: string; fields: { name: string; value: unknown }[] };
  };

  // Entity ID carries identity: "reviewId:scopeType:scopeId"
  expect(outbox.entityId).toBe("review-1:pillar:pillar-1");
  // Only content is a field — identity is not mutable data
  expect(outbox.fields).toHaveLength(1);
  expect(outbox.fields[0]!.name).toBe("content");
  expect(outbox.fields[0]!.value).toBe("my note");
});

it("save() stamps content with an HLC", async () => {
  await noteMutations.save("review-1", "question", "q-1", "note text");

  const { outbox } = localMutationCommit.mock.calls[0]![0] as {
    outbox: { fields: { name: string; hlc: string }[] };
  };

  expect(outbox.fields).toHaveLength(1);
  expect(outbox.fields[0]!.hlc).toMatch(/^\d+:\d{4}:.+$/);
});

it("save() throws if reviewId is missing", async () => {
  await expect(
    noteMutations.save("", "review", "review-1", "content")
  ).rejects.toThrow("reviewId is required");
});

it("delete() uses operation delete with empty fields", async () => {
  await noteMutations.delete("review-1", "pillar", "pillar-1");

  expect(localMutationCommit).toHaveBeenCalledOnce();
  const { outbox } = localMutationCommit.mock.calls[0]![0] as {
    outbox: { operation: string; fields: unknown[] };
  };

  expect(outbox.operation).toBe("delete");
  // Deletes carry no fields — slice 6 addresses delete semantics.
  expect(outbox.fields).toEqual([]);
});
