import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  clearLifecycleAuditEvents,
  recordLifecycleAuditEvent,
} from "../../../server/data/lifecycle-audit";

type AdminEventsHandler =
  (typeof import("../../../server/api/admin/events.get"))["default"];

const createErrorStub = (input: {
  statusCode: number;
  statusMessage: string;
}) => {
  return Object.assign(new Error(input.statusMessage), input);
};

describe("Admin events API", () => {
  let adminEventsHandler: AdminEventsHandler;
  let headerValues: Record<string, string | undefined>;

  beforeAll(async () => {
    vi.stubGlobal("defineEventHandler", (handler: unknown) => handler);
    adminEventsHandler = (await import("../../../server/api/admin/events.get"))
      .default;
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

  afterEach(() => {
    clearLifecycleAuditEvents();
    vi.unstubAllGlobals();
  });

  it("merges lifecycle audit events with review events", async () => {
    recordLifecycleAuditEvent({
      action: "archive",
      subjectType: "product",
      subjectId: "product-001",
      subjectName: "Customer Portal",
      actor: {
        id: "heitorl",
        name: "Heitor Lessa",
        roles: ["admin"],
      },
      associatedResources: {
        reviewsCount: 2,
        activeReviewCount: 1,
      },
    });

    const result = await adminEventsHandler({} as never);

    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "product",
          action: "archive",
          subjectId: "product-001",
          subjectName: "Customer Portal",
          actorName: "Heitor Lessa",
          status: "synced",
        }),
        expect.objectContaining({
          category: "integration",
          action: "ReviewAnswerImported.v1",
          actorName: "CI/CD Pipeline",
        }),
      ])
    );
  });

  it("rejects non-admin actors", async () => {
    headerValues = {
      "x-actor-id": "member-001",
      "x-actor-name": "Regular Member",
      "x-actor-roles": "member",
    };

    await expect(adminEventsHandler({} as never)).rejects.toThrow(
      "Only admins can view audit events"
    );
  });
});
