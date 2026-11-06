import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

type UploadHandler =
  (typeof import("../../../server/api/reviews/[id]/pillars/[pillarId]/attachments.post"))["default"];

const createErrorStub = (input: {
  statusCode: number;
  statusMessage: string;
}) => Object.assign(new Error(input.statusMessage), input);

describe("review attachment API", () => {
  let uploadHandler: UploadHandler;
  let routerParams: Record<string, string | undefined>;
  let headerValues: Record<string, string | undefined>;

  beforeAll(async () => {
    vi.stubGlobal("defineEventHandler", (handler: unknown) => handler);
    uploadHandler = (
      await import("../../../server/api/reviews/[id]/pillars/[pillarId]/attachments.post")
    ).default;
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    routerParams = {
      id: "01932b3c-7d00-7000-8000-000000002001",
      pillarId: "reliability",
    };
    headerValues = {
      "x-actor-id": "heitorl",
      "x-actor-name": "Heitor Lessa",
      "x-actor-roles": "admin",
    };

    vi.stubGlobal("createError", createErrorStub);
    vi.stubGlobal(
      "getRouterParam",
      vi.fn((_event, name: string) => routerParams[name])
    );
    vi.stubGlobal(
      "getHeader",
      vi.fn((_event, name: string) => headerValues[name])
    );
    vi.stubGlobal(
      "getQuery",
      vi.fn(() => ({}))
    );
    vi.stubGlobal(
      "readMultipartFormData",
      vi.fn(async () => [
        {
          name: "file",
          filename: "evidence.pdf",
          type: "application/pdf",
          data: Buffer.from("hello"),
        },
      ])
    );
  });

  it("uses the current actor from headers for uploaded attachment metadata", async () => {
    const attachment = await uploadHandler({} as never);

    expect(attachment).toEqual(
      expect.objectContaining({
        createdBy: "heitorl",
        createdByName: "Heitor Lessa",
        filename: "evidence.pdf",
      })
    );
  });

  it("rejects uploads from unauthorized actors", async () => {
    headerValues = {
      "x-actor-id": "outsider",
      "x-actor-name": "Outsider",
      "x-actor-roles": "member",
    };

    await expect(uploadHandler({} as never)).rejects.toMatchObject({
      statusCode: 403,
      statusMessage:
        "Only authorized review participants or admins can modify notes and attachments",
    });
  });
});
