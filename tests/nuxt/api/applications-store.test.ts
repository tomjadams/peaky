import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import type { H3Event } from "h3";
import type * as ApplicationsModule from "../../../server/data/applications";

// oxlint-disable-next-line no-redundant-type-constituents
type EventHandler = (event: H3Event) => Promise<unknown> | unknown;

// Global stubs for Nitro handlers
let mockRouterParams: Record<string, string> = {};
let mockRequestBody: unknown = null;

const defineEventHandler = (handler: EventHandler) => handler as unknown;
const getRouterParam = (_event: H3Event, key: string) => mockRouterParams[key];
const readBody = async (_event: H3Event) => mockRequestBody;
const createError = (opts: { statusCode: number; statusMessage: string }) => {
  const err = new Error(opts.statusMessage) as unknown as Record<
    string,
    unknown
  >;
  err.statusCode = opts.statusCode;
  throw err;
};

// Stub globals before imports
(globalThis as Record<string, unknown>).defineEventHandler = defineEventHandler;
(globalThis as Record<string, unknown>).getRouterParam = getRouterParam;
(globalThis as Record<string, unknown>).readBody = readBody;
(globalThis as Record<string, unknown>).createError = createError;

// Dynamic import after stubs
let getListHandler: EventHandler;
let deleteHandler: EventHandler;
let archiveHandler: EventHandler;
let transferHandler: EventHandler;
let applicationsData: typeof ApplicationsModule;

const createMockEvent = (): H3Event => ({ context: {} }) as H3Event;

const withApplicationMetadata = (application: {
  id: string;
  name: string;
  status: "ready" | "in_progress" | "action_needed";
  owner: string;
  lastUpdated: string;
  progress: number;
  teamId?: string;
  orgId?: string;
  orgName?: string;
  productId?: string;
  productName?: string;
}) => ({
  teamId: "wd_account_management",
  orgId: "org-customer-experience",
  orgName: "Customer Experience",
  productId: "product-customer-suite",
  productName: "Customer Experience Suite",
  ...application,
});

// Helper to reset the applications array to seed state
const seedApplications = () => {
  applicationsData.applications.length = 0;
  applicationsData.applications.push(
    withApplicationMetadata({
      id: "app-001",
      name: "Launchpad System",
      status: "ready",
      owner: "Developer Portal Experience - DPX",
      teamId: "idp-developer_portal_experience",
      orgId: "org-platform-engineering",
      orgName: "Platform Engineering",
      productId: "product-platform-control-plane",
      productName: "Platform Control Plane",
      lastUpdated: "2026-02-18T09:00:00Z",
      progress: 100,
    }),
    withApplicationMetadata({
      id: "app-002",
      name: "ModificationQueueProcessor",
      status: "in_progress",
      owner: "Payments Scalability",
      teamId: "payments-scalability",
      orgId: "org-payments",
      orgName: "Payments",
      productId: "product-001",
      productName: "Demo Payments Scalability",
      lastUpdated: "2026-02-12T14:00:00Z",
      progress: 65,
    }),
    withApplicationMetadata({
      id: "app-003",
      name: "Access Portal System",
      status: "ready",
      owner: "Internal Services",
      teamId: "be-internal_services",
      orgId: "org-business-enablement",
      orgName: "Business Enablement",
      productId: "product-operations-insights",
      productName: "Operations Insights",
      lastUpdated: "2026-02-08T16:45:00Z",
      progress: 100,
    }),
    withApplicationMetadata({
      id: "app-004",
      name: "Looker System",
      status: "action_needed",
      owner: "Internal Services",
      teamId: "be-internal_services",
      orgId: "org-business-enablement",
      orgName: "Business Enablement",
      productId: "product-operations-insights",
      productName: "Operations Insights",
      lastUpdated: "2026-02-10T13:30:00Z",
      progress: 30,
    })
  );
};

describe("Applications Mutable Store", () => {
  beforeAll(async () => {
    const getListModule =
      await import("../../../server/api/applications/index.get");
    const deleteModule =
      await import("../../../server/api/applications/bulk/delete.post");
    const archiveModule =
      await import("../../../server/api/applications/bulk/archive.post");
    const transferModule =
      await import("../../../server/api/applications/bulk/transfer.post");
    applicationsData = await import("../../../server/data/applications");

    getListHandler = getListModule.default;
    deleteHandler = deleteModule.default;
    archiveHandler = archiveModule.default;
    transferHandler = transferModule.default;
  });

  beforeEach(() => {
    mockRouterParams = {};
    mockRequestBody = null;
    seedApplications();
  });

  describe("Seed data", () => {
    it("has 4 seed applications", () => {
      expect(applicationsData.applications).toHaveLength(4);
    });

    it("seed applications have required fields", () => {
      for (const app of applicationsData.applications) {
        expect(app).toHaveProperty("id");
        expect(app).toHaveProperty("name");
        expect(app).toHaveProperty("status");
        expect(app).toHaveProperty("owner");
        expect(app).toHaveProperty("teamId");
        expect(app).toHaveProperty("orgId");
        expect(app).toHaveProperty("orgName");
        expect(app).toHaveProperty("productId");
        expect(app).toHaveProperty("productName");
        expect(app).toHaveProperty("lastUpdated");
        expect(app).toHaveProperty("progress");
      }
    });
  });

  describe("GET /api/applications", () => {
    it("returns all applications from store", async () => {
      const result = (await getListHandler(
        createMockEvent()
      )) as Array<unknown>;
      expect(result).toHaveLength(4);
    });

    it("returns applications with correct structure", async () => {
      const result = (await getListHandler(createMockEvent())) as Array<{
        id: string;
        name: string;
      }>;
      expect(result[0]).toHaveProperty("id", "app-001");
      expect(result[0]).toHaveProperty("name", "Launchpad System");
    });
  });

  describe("POST /api/applications/bulk/delete", () => {
    it("removes applications from the store", async () => {
      mockRequestBody = { ids: ["app-001", "app-002"] };
      const result = (await deleteHandler(createMockEvent())) as {
        success: boolean;
        message: string;
      };

      expect(result.success).toBe(true);
      expect(applicationsData.applications).toHaveLength(2);
    });

    it("deleted applications not returned by GET list", async () => {
      mockRequestBody = { ids: ["app-001"] };
      await deleteHandler(createMockEvent());

      const list = (await getListHandler(createMockEvent())) as Array<{
        id: string;
      }>;
      const ids = list.map((a) => a.id);
      expect(ids).not.toContain("app-001");
    });

    it("returns 400 when ids is missing", async () => {
      mockRequestBody = {};
      try {
        await deleteHandler(createMockEvent());
        expect.fail("Should have thrown");
      } catch (err) {
        expect((err as Record<string, unknown>).statusCode).toBe(400);
      }
    });

    it("returns 400 when ids is not an array", async () => {
      mockRequestBody = { ids: "not-an-array" };
      try {
        await deleteHandler(createMockEvent());
        expect.fail("Should have thrown");
      } catch (err) {
        expect((err as Record<string, unknown>).statusCode).toBe(400);
      }
    });

    it("preserves unrelated applications after delete", async () => {
      mockRequestBody = { ids: ["app-001"] };
      await deleteHandler(createMockEvent());

      const remaining = applicationsData.applications.map((a) => a.id);
      expect(remaining).toContain("app-002");
      expect(remaining).toContain("app-004");
    });
  });

  describe("POST /api/applications/bulk/archive", () => {
    it("marks applications as archived", async () => {
      mockRequestBody = { ids: ["app-001", "app-002"] };
      const result = (await archiveHandler(createMockEvent())) as {
        success: boolean;
      };

      expect(result.success).toBe(true);

      const app1 = applicationsData.applications.find(
        (a) => a.id === "app-001"
      );
      const app2 = applicationsData.applications.find(
        (a) => a.id === "app-002"
      );
      expect(app1?.archived).toBe(true);
      expect(app2?.archived).toBe(true);
    });

    it("archived flag visible in GET list", async () => {
      mockRequestBody = { ids: ["app-003"] };
      await archiveHandler(createMockEvent());

      const list = (await getListHandler(createMockEvent())) as Array<{
        id: string;
        archived?: boolean;
      }>;
      const app3 = list.find((a) => a.id === "app-003");
      expect(app3?.archived).toBe(true);
    });

    it("non-archived applications remain unchanged", async () => {
      mockRequestBody = { ids: ["app-001"] };
      await archiveHandler(createMockEvent());

      const app2 = applicationsData.applications.find(
        (a) => a.id === "app-002"
      );
      expect(app2?.archived).toBeUndefined();
    });

    it("returns 400 when ids is missing", async () => {
      mockRequestBody = {};
      try {
        await archiveHandler(createMockEvent());
        expect.fail("Should have thrown");
      } catch (err) {
        expect((err as Record<string, unknown>).statusCode).toBe(400);
      }
    });
  });

  describe("POST /api/applications/bulk/transfer", () => {
    it("updates owner on matching applications", async () => {
      mockRequestBody = { ids: ["app-001", "app-002"], newOwner: "New Team" };
      const result = (await transferHandler(createMockEvent())) as {
        success: boolean;
        newOwner: string;
      };

      expect(result.success).toBe(true);
      expect(result.newOwner).toBe("New Team");

      const app1 = applicationsData.applications.find(
        (a) => a.id === "app-001"
      );
      const app2 = applicationsData.applications.find(
        (a) => a.id === "app-002"
      );
      expect(app1?.owner).toBe("New Team");
      expect(app2?.owner).toBe("New Team");
    });

    it("transferred owner visible in GET list", async () => {
      mockRequestBody = {
        ids: ["app-004"],
        newOwner: "Transferred Team",
      };
      await transferHandler(createMockEvent());

      const list = (await getListHandler(createMockEvent())) as Array<{
        id: string;
        owner: string;
      }>;
      const app = list.find((item) => item.id === "app-004");
      expect(app?.owner).toBe("Transferred Team");
    });

    it("non-transferred applications remain unchanged", async () => {
      mockRequestBody = { ids: ["app-001"], newOwner: "New Team" };
      await transferHandler(createMockEvent());

      const app2 = applicationsData.applications.find(
        (a) => a.id === "app-002"
      );
      expect(app2?.owner).toBe("Payments Scalability");
    });

    it("returns 400 when ids is missing", async () => {
      mockRequestBody = { newOwner: "Team" };
      try {
        await transferHandler(createMockEvent());
        expect.fail("Should have thrown");
      } catch (err) {
        expect((err as Record<string, unknown>).statusCode).toBe(400);
      }
    });

    it("returns 400 when newOwner is missing", async () => {
      mockRequestBody = { ids: ["app-001"] };
      try {
        await transferHandler(createMockEvent());
        expect.fail("Should have thrown");
      } catch (err) {
        expect((err as Record<string, unknown>).statusCode).toBe(400);
      }
    });
  });

  describe("Cross-request persistence", () => {
    it("mutations persist across multiple handler calls", async () => {
      // Delete app-001
      mockRequestBody = { ids: ["app-001"] };
      await deleteHandler(createMockEvent());

      // Archive app-002
      mockRequestBody = { ids: ["app-002"] };
      await archiveHandler(createMockEvent());

      // Transfer app-003
      mockRequestBody = {
        ids: ["app-003"],
        newOwner: "Transferred Team",
      };
      await transferHandler(createMockEvent());

      // Verify all mutations persisted
      const list = (await getListHandler(createMockEvent())) as Array<{
        id: string;
        archived?: boolean;
        owner: string;
      }>;
      expect(list).toHaveLength(3);
      expect(list.find((a) => a.id === "app-001")).toBeUndefined();

      const app2 = list.find((a) => a.id === "app-002");
      expect(app2?.archived).toBe(true);

      const app3 = list.find((a) => a.id === "app-003");
      expect(app3?.owner).toBe("Transferred Team");
    });

    it("seed applications remain listed after unrelated mutations", async () => {
      mockRequestBody = { ids: ["app-001"] };
      await deleteHandler(createMockEvent());

      const list = (await getListHandler(createMockEvent())) as Array<{
        id: string;
      }>;
      const ids = list.map((application) => application.id);

      expect(ids).toEqual(["app-002", "app-003", "app-004"]);
    });
  });

  describe("Field name convention (ids not applicationIds)", () => {
    it("bulk delete accepts ids field", async () => {
      mockRequestBody = { ids: ["app-001"] };
      const result = (await deleteHandler(createMockEvent())) as {
        success: boolean;
        ids: string[];
      };
      expect(result.success).toBe(true);
      expect(result.ids).toEqual(["app-001"]);
    });

    it("bulk archive accepts ids field", async () => {
      mockRequestBody = { ids: ["app-001"] };
      const result = (await archiveHandler(createMockEvent())) as {
        success: boolean;
        ids: string[];
      };
      expect(result.success).toBe(true);
      expect(result.ids).toEqual(["app-001"]);
    });

    it("bulk transfer accepts ids field", async () => {
      mockRequestBody = { ids: ["app-001"], newOwner: "Team" };
      const result = (await transferHandler(createMockEvent())) as {
        success: boolean;
        ids: string[];
      };
      expect(result.success).toBe(true);
      expect(result.ids).toEqual(["app-001"]);
    });
  });
});
