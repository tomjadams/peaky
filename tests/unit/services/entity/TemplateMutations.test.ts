import { beforeEach, expect, it, vi } from "vitest";
import type * as LocalDb from "~/local-db";

vi.mock("~/local-db", async (importOriginal) => {
  const actual = await importOriginal<typeof LocalDb>();
  return {
    ...actual,
    withDatabase: vi.fn(),
  };
});

vi.mock("~/services/local-mutation", () => ({
  localMutation: {
    commit: vi.fn(),
  },
}));

let localMutationCommit: ReturnType<typeof vi.fn>;
let withDatabase: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  vi.clearAllMocks();
  const { localMutation } = await import("~/services/local-mutation");
  localMutationCommit = vi.mocked(localMutation.commit);
  const localDb = await import("~/local-db");
  withDatabase = vi.mocked(localDb.withDatabase);
});

it("publish() fails closed before reads or writes", async () => {
  const { templateMutations } =
    await import("~/services/entity/TemplateMutations");

  await expect(templateMutations.publish("tpl-1")).resolves.toMatchObject({
    success: false,
    code: "template_write_unavailable",
  });
  expect(withDatabase).not.toHaveBeenCalled();
  expect(localMutationCommit).not.toHaveBeenCalled();
});

it("publish() still validates the Template identity", async () => {
  const { templateMutations } =
    await import("~/services/entity/TemplateMutations");

  await expect(templateMutations.publish("")).rejects.toThrow(
    "templateId is required"
  );
});
