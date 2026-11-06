import { expect, it, vi } from "vitest";

const createLocalTemplateDraft = vi.hoisted(() =>
  vi.fn().mockResolvedValue("revision-created")
);

vi.mock("~/composables/local/useLocalTemplateDraft", () => ({
  createLocalTemplateDraft,
  updateLocalTemplateDraft: vi.fn(),
}));

vi.mock("~/composables/local/useLocalTemplateImport", () => ({
  importLocalTemplateFromMarkdown: vi.fn(),
  resolveLocalImportConflict: vi.fn(),
}));

it("creates through the local persistence boundary with explicit ownership", async () => {
  const { TemplatePersistence } =
    await import("~/services/template/TemplatePersistence");
  const input = {
    name: "Operational Readiness",
    description: "Initial draft",
    ownerTeamId: "team-platform",
    actorId: "actor-creator",
  } as const;

  await expect(new TemplatePersistence().createDraft(input)).resolves.toBe(
    "revision-created"
  );
  expect(createLocalTemplateDraft).toHaveBeenCalledWith(input);
});
