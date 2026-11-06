import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { H3Event } from "h3";
import type * as TemplatesModule from "../../../server/data/templates";
import {
  createMockEvent,
  resetNitroStubs,
  setBody,
  setRouterParam,
  setQuery,
  setupNitroStubs,
} from "../helpers/nitro";

// oxlint-disable-next-line no-redundant-type-constituents
type EventHandler = (event: H3Event) => Promise<unknown> | unknown;

let postHandler: EventHandler;
let putHandler: EventHandler;
let getHandler: EventHandler;
let getListHandler: EventHandler;
let publishHandler: EventHandler;
let deleteHandler: EventHandler;
let templatesData: typeof TemplatesModule;

async function expectFailure(
  handler: EventHandler,
  expected: Record<string, unknown>
): Promise<void> {
  try {
    await handler(createMockEvent());
    expect.fail("Expected handler to reject");
  } catch (error) {
    expect(error).toMatchObject(expected);
  }
}

async function expectUnavailable(handler: EventHandler): Promise<void> {
  await expectFailure(handler, {
    statusCode: 503,
    statusMessage: "Template write unavailable",
    data: { code: "template_write_unavailable" },
  });
}

describe("Templates fail-closed store", () => {
  const stubs = setupNitroStubs();

  beforeAll(async () => {
    const postModule = await import("../../../server/api/templates/index.post");
    const putModule = await import("../../../server/api/templates/[id].put");
    const getModule = await import("../../../server/api/templates/[id].get");
    const getListModule =
      await import("../../../server/api/templates/index.get");
    const publishModule =
      await import("../../../server/api/templates/[id]/publish.post");
    const deleteModule =
      await import("../../../server/api/templates/[id].delete");
    templatesData = await import("../../../server/data/templates");

    postHandler = postModule.default;
    putHandler = putModule.default;
    getHandler = getModule.default;
    getListHandler = getListModule.default;
    publishHandler = publishModule.default;
    deleteHandler = deleteModule.default;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    resetNitroStubs(stubs);
  });

  function snapshotStore(): string {
    return JSON.stringify({
      templates: templatesData.templates,
      details: templatesData.templateDetails,
    });
  }

  it("POST rejects before reading input or mutating state", async () => {
    const before = snapshotStore();
    setBody(stubs, { name: "Must not be created" });

    await expectUnavailable(postHandler);
    expect(vi.mocked(readBody)).not.toHaveBeenCalled();
    expect(vi.mocked(getHeader)).not.toHaveBeenCalled();
    expect(snapshotStore()).toBe(before);
  });

  it.each([
    ["metadata update", () => putHandler, { name: "Must not change" }],
    ["archive", () => putHandler, { status: "archived" }],
    ["restore", () => putHandler, { status: "active" }],
    [
      "Revision publication fields",
      () => putHandler,
      {
        status: "published",
        revisionNumber: 2,
        publishedAt: "2026-08-20T10:00:00Z",
        publishedByActorId: "actor-publisher",
      },
    ],
    ["whole-draft delete", () => deleteHandler, { mode: "draft" }],
    [
      "permanent delete",
      () => deleteHandler,
      { confirmationName: "Operational Readiness" },
    ],
    ["publication", () => publishHandler, {}],
  ])(
    "%s rejects with no fixture mutation",
    async (_name, resolveHandler, body) => {
      const before = snapshotStore();
      setRouterParam(stubs, "id", templatesData.templates[0]!.template.id);
      setBody(stubs, body);

      await expectUnavailable(resolveHandler());
      expect(vi.mocked(readBody)).not.toHaveBeenCalled();
      expect(vi.mocked(getHeader)).not.toHaveBeenCalled();
      expect(snapshotStore()).toBe(before);
    }
  );

  it.each([
    ["PUT", () => putHandler],
    ["DELETE", () => deleteHandler],
    ["publish", () => publishHandler],
  ])(
    "%s still validates a missing Template identity",
    async (_name, resolveHandler) => {
      await expectFailure(resolveHandler(), { statusCode: 400 });
    }
  );

  it("keeps deterministic Template detail reads available", async () => {
    const entry = templatesData.templates[0]!;
    setRouterParam(stubs, "id", entry.template.id);

    expect(await getHandler(createMockEvent())).toMatchObject({
      template: { id: entry.template.id },
      revision: {
        id: entry.publishedRevisions[0]?.id,
      },
    });
  });

  it("keeps deterministic Template list reads available", async () => {
    expect(await getListHandler(createMockEvent())).toMatchObject({
      templates: expect.arrayContaining([
        expect.objectContaining({
          template: expect.objectContaining({
            id: templatesData.templates[0]!.template.id,
          }),
          reviewsCount: expect.any(Number),
        }),
      ]),
    });
  });

  it("filters Template aggregate lifecycle independently", async () => {
    setQuery(stubs, { status: "active" });
    const response = (await getListHandler(createMockEvent())) as {
      templates: typeof templatesData.templates;
    };

    expect(response.templates.length).toBeGreaterThan(0);
    expect(
      response.templates.every((entry) => entry.template.status === "active")
    ).toBe(true);
  });

  it("rejects an invalid Template lifecycle filter", async () => {
    setQuery(stubs, { status: "published" });
    await expectFailure(getListHandler, {
      statusCode: 400,
      statusMessage: "Invalid Template lifecycle status",
    });
  });
});
