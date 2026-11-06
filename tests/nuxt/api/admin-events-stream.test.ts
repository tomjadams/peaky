import { EventEmitter } from "node:events";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

type AdminEventsStreamHandler =
  (typeof import("../../../server/api/admin/events/stream.get"))["default"];

const createErrorStub = (input: {
  statusCode: number;
  statusMessage: string;
}) => {
  return Object.assign(new Error(input.statusMessage), input);
};

describe("Admin events SSE API", () => {
  let adminEventsStreamHandler: AdminEventsStreamHandler;
  let headerValues: Record<string, string | undefined>;

  beforeAll(async () => {
    vi.stubGlobal("defineEventHandler", (handler: unknown) => handler);
    adminEventsStreamHandler = (
      await import("../../../server/api/admin/events/stream.get")
    ).default;
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    headerValues = {
      "x-actor-id": "heitorl",
      "x-actor-name": "Heitor Lessa",
      "x-actor-roles": "admin",
    };

    vi.stubGlobal("createError", createErrorStub);
    vi.stubGlobal(
      "getHeader",
      vi.fn((_event, name: string) => headerValues[name])
    );
  });

  it("returns an SSE response for admins", async () => {
    const req = new EventEmitter();
    const response = await adminEventsStreamHandler({ node: { req } } as never);

    expect(response).toBeInstanceOf(Response);
    expect(response.headers.get("content-type")).toBe("text/event-stream");

    const reader = response.body?.getReader();
    expect(reader).toBeDefined();

    const chunk = await reader?.read();
    const payload = new TextDecoder().decode(chunk?.value);

    expect(payload).toContain("event: connected");
    req.emit("close");
  });

  it("rejects non-admin actors", async () => {
    headerValues = {
      "x-actor-id": "member-001",
      "x-actor-name": "Regular Member",
      "x-actor-roles": "member",
    };

    await expect(
      adminEventsStreamHandler({ node: { req: new EventEmitter() } } as never)
    ).rejects.toThrow("Only admins can live-tail audit events");
  });
});
