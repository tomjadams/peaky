import { beforeEach, expect, it, vi } from "vitest";
import { getDefaultLifecycleActor } from "~/lifecycle/management";
import { TemplateCatalog } from "~/services/template/TemplateCatalog";
import { templates, templateDetails } from "../../../../server/data/templates";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("$fetch", fetchMock);
});

function fixtureSnapshot(): string {
  return JSON.stringify({ templates, templateDetails });
}

it.each([
  [
    "remote creation",
    () => new TemplateCatalog().saveDetail({ id: "" } as never),
  ],
  [
    "remote update",
    () => new TemplateCatalog().saveDetail({ id: "template-1" } as never),
  ],
  [
    "archive",
    () =>
      new TemplateCatalog().updateStatus(
        "template-1",
        "archived",
        getDefaultLifecycleActor()
      ),
  ],
  [
    "restore",
    () =>
      new TemplateCatalog().updateStatus(
        "template-1",
        "active",
        getDefaultLifecycleActor()
      ),
  ],
  [
    "permanent delete",
    () =>
      new TemplateCatalog().deleteTemplate(
        "template-1",
        "Operational Readiness",
        getDefaultLifecycleActor()
      ),
  ],
])(
  "%s rejects before network or fixture mutation",
  async (_name, operation) => {
    const before = fixtureSnapshot();

    await expect(operation()).rejects.toMatchObject({
      code: "template_write_unavailable",
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(fixtureSnapshot()).toBe(before);
  }
);

it("publication returns the stable unavailable result without optimistic mutation", async () => {
  const before = fixtureSnapshot();

  await expect(new TemplateCatalog().publish("template-1")).resolves.toEqual({
    success: false,
    code: "template_write_unavailable",
    errors: ["Template publication is unavailable"],
  });
  expect(fetchMock).not.toHaveBeenCalled();
  expect(fixtureSnapshot()).toBe(before);
});
