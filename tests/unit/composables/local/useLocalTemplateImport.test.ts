import { beforeEach, expect, it, vi } from "vitest";
import type * as LocalDb from "~/local-db";

vi.mock("~/local-db", async (importOriginal) => {
  const actual = await importOriginal<typeof LocalDb>();
  return {
    ...actual,
    withDatabase: vi.fn(),
    createUuidV7: vi.fn(() => "uuid-test"),
  };
});

vi.mock("~/services/local-mutation", () => ({
  localMutation: {
    localOnly: vi.fn().mockResolvedValue(undefined),
    draft: vi.fn(),
  },
}));

vi.mock("~/composables/local/useLocalTemplateDraft", () => ({
  updateLocalTemplateDraft: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("~/composables/local/useLocalTemplatePillars", () => ({
  addLocalPillar: vi.fn().mockResolvedValue("pillar-id"),
  updateLocalPillar: vi.fn().mockResolvedValue(undefined),
}));

let localOnly: ReturnType<typeof vi.fn>;
let draft: ReturnType<typeof vi.fn>;
let withDatabase: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  vi.clearAllMocks();
  const { localMutation } = await import("~/services/local-mutation");
  localOnly = vi.mocked(localMutation.localOnly);
  draft = vi.mocked(localMutation.draft);
  const localDb = await import("~/local-db");
  withDatabase = vi.mocked(localDb.withDatabase);
  withDatabase.mockResolvedValue([]);
});

it("importLocalTemplateFromMarkdown() records provenance through localOnly", async () => {
  const { importLocalTemplateFromMarkdown } =
    await import("~/composables/local/useLocalTemplateImport");

  await importLocalTemplateFromMarkdown("revision-1", {
    name: "Imported Template",
    pillars: [],
  });

  expect(localOnly).toHaveBeenCalledOnce();
  expect(draft).not.toHaveBeenCalled();
});

it("resolveLocalImportConflict() records resolution through localOnly", async () => {
  const { resolveLocalImportConflict } =
    await import("~/composables/local/useLocalTemplateImport");

  await resolveLocalImportConflict(
    "revision-1",
    {
      type: "pillar",
      localId: "pillar-1",
      localValue: "Old: desc",
      importedValue: "New: desc",
    },
    "keep_local"
  );

  expect(localOnly).toHaveBeenCalledOnce();
  expect(draft).not.toHaveBeenCalled();
});

it("resolveLocalImportConflict() delegates keep_imported to updateLocalPillar", async () => {
  const { updateLocalPillar } =
    await import("~/composables/local/useLocalTemplatePillars");
  const { resolveLocalImportConflict } =
    await import("~/composables/local/useLocalTemplateImport");

  await resolveLocalImportConflict(
    "revision-1",
    {
      type: "pillar",
      localId: "pillar-1",
      localValue: "Old: desc",
      importedValue: "New: desc",
      imported: { name: "New", description: "desc" },
    },
    "keep_imported"
  );

  expect(vi.mocked(updateLocalPillar)).toHaveBeenCalledWith("pillar-1", {
    name: "New",
    description: "desc",
  });
  expect(localOnly).toHaveBeenCalledOnce();
  expect(draft).not.toHaveBeenCalled();
});
