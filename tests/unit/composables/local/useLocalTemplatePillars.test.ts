import { beforeEach, expect, it, vi } from "vitest";

vi.mock("~/local-db", () => ({
  createUuidV7: vi.fn(() => "uuid-test"),
  generateOrderKey: vi.fn((n: number) => String(n).padStart(4, "0")),
}));

vi.mock("~/lifecycle/management", () => ({
  getDefaultLifecycleActor: vi.fn(() => ({
    id: "actor-editor",
    name: "Editor",
  })),
}));

vi.mock("~/services/local-mutation", () => ({
  localMutation: {
    localOnly: vi.fn().mockResolvedValue(undefined),
    draft: vi.fn(),
    draftBatch: vi.fn(),
  },
}));

let localOnly: ReturnType<typeof vi.fn>;
let draft: ReturnType<typeof vi.fn>;
let draftBatch: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  vi.clearAllMocks();
  const { localMutation } = await import("~/services/local-mutation");
  localOnly = vi.mocked(localMutation.localOnly);
  draft = vi.mocked(localMutation.draft);
  draftBatch = vi.mocked(localMutation.draftBatch);
});

it("addLocalPillar() uses the state-only path", async () => {
  const { addLocalPillar } =
    await import("~/composables/local/useLocalTemplatePillars");

  await expect(
    addLocalPillar("revision-1", "Reliability", "reliability", "desc")
  ).resolves.toBe("uuid-test");
  expect(localOnly).toHaveBeenCalledOnce();
  expect(draft).not.toHaveBeenCalled();
});

it("updateLocalPillar() uses the state-only path", async () => {
  const { updateLocalPillar } =
    await import("~/composables/local/useLocalTemplatePillars");

  await updateLocalPillar("pillar-1", { name: "New Name" });
  expect(localOnly).toHaveBeenCalledOnce();
  expect(draft).not.toHaveBeenCalled();
});

it("deleteLocalPillar() uses the state-only path", async () => {
  const { deleteLocalPillar } =
    await import("~/composables/local/useLocalTemplatePillars");

  await deleteLocalPillar("pillar-1");
  expect(localOnly).toHaveBeenCalledOnce();
  expect(draft).not.toHaveBeenCalled();
});

it("reorderLocalPillars() uses one state-only transaction", async () => {
  const { reorderLocalPillars } =
    await import("~/composables/local/useLocalTemplatePillars");

  await reorderLocalPillars("revision-1", ["pillar-1", "pillar-2"]);
  expect(localOnly).toHaveBeenCalledOnce();
  expect(draftBatch).not.toHaveBeenCalled();
});

it("reorderLocalPillars() rejects an empty Pillar identity before writing", async () => {
  const { reorderLocalPillars } =
    await import("~/composables/local/useLocalTemplatePillars");

  await expect(
    reorderLocalPillars("revision-1", ["pillar-1", ""])
  ).rejects.toThrow("pillarIds contains an empty entry");
  expect(localOnly).not.toHaveBeenCalled();
});
