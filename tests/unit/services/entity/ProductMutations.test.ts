import { beforeEach, expect, it, vi } from "vitest";
import type * as LocalDb from "~/local-db";
import { ProductMutations } from "~/services/entity/ProductMutations";

vi.mock("~/local-db", async (importOriginal) => {
  const actual = await importOriginal<typeof LocalDb>();
  return {
    ...actual,
    nowISO: vi.fn(() => "2026-03-26T10:00:00.000Z"),
    createUuidV7: vi.fn(() => "uuid-test"),
    withDatabase: vi.fn(),
    firstOrNull: actual.firstOrNull,
  };
});

vi.mock("~/composables/auth/useCurrentActor", () => ({
  readPersistedActor: vi.fn().mockReturnValue({
    id: "user-001",
    name: "Test User",
    roles: ["member"],
  }),
}));

vi.mock("~/services/local-mutation", () => ({
  localMutation: {
    draft: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue({ eventId: "evt_test" }),
    replay: vi.fn().mockResolvedValue({ eventId: "evt_test" }),
  },
}));

// HLC clock — returns incrementing values so tests can distinguish per-field
// stamping (each field gets a unique HLC) from atomic stamping (all share one).
const hlcState = vi.hoisted(() => ({ counter: 0 }));
vi.mock("~/services/sync/syncClock", () => ({
  getHLCClock: vi.fn().mockReturnValue({
    now: vi.fn(
      () => `1000:${String(++hlcState.counter).padStart(4, "0")}:user-001`
    ),
  }),
  resetHLCClock: vi.fn(),
}));

vi.mock("~/lifecycle/management", () => ({
  assertLifecycleConfirmation: vi.fn(),
  getDefaultLifecycleActor: vi
    .fn()
    .mockReturnValue({ id: "system", name: "System" }),
}));

vi.mock("~/services/entity/ProductQueries", () => ({
  fetchLocalProductRecords: vi.fn(),
  fetchReviewMetrics: vi.fn().mockResolvedValue(new Map()),
  parseProductProfile: vi.fn((record) => record),
  createProductLifecycleAuditRecord: vi.fn(),
}));

let productMutations: ProductMutations;
let localMutationCommit: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  vi.clearAllMocks();
  hlcState.counter = 0;
  productMutations = new ProductMutations();
  const { localMutation } = await import("~/services/local-mutation");
  localMutationCommit = vi.mocked(localMutation.commit);
});

// ── create() ────────────────────────────────────────────────────────────────

it("create() routes through localMutation.commit with operation upsert", async () => {
  await productMutations.create({
    name: "Test Product",
    origin: "bespoke",
    isExternal: false,
    productManagerId: "pm-1",
    teamIds: ["team-1"],
    componentIds: ["comp-1"],
    createdBy: "user-001",
  });

  expect(localMutationCommit).toHaveBeenCalledOnce();
  const { outbox } = localMutationCommit.mock.calls[0]![0] as {
    outbox: { operation: string };
  };
  expect(outbox.operation).toBe("upsert");
});

it("create() sends all handler-expected fields", async () => {
  await productMutations.create({
    name: "Test Product",
    origin: "bespoke",
    isExternal: true,
    productManagerId: "pm-1",
    engineeringLeadId: "el-1",
    teamIds: ["team-1"],
    componentIds: ["comp-1"],
    roadmapUrl: "https://example.com",
    documentationUrl: "https://docs.example.com",
    supportChannel: "#support",
    createdBy: "user-001",
  });

  const { outbox } = localMutationCommit.mock.calls[0]![0] as {
    outbox: { fields: { name: string }[] };
  };
  const fieldNames = outbox.fields.map((f) => f.name);
  expect(fieldNames).toContain("name");
  expect(fieldNames).toContain("slug");
  expect(fieldNames).toContain("status");
  expect(fieldNames).toContain("origin");
  expect(fieldNames).toContain("isExternal");
  expect(fieldNames).toContain("productManagerId");
  expect(fieldNames).toContain("engineeringLeadId");
  expect(fieldNames).toContain("teamIds");
  expect(fieldNames).toContain("componentIds");
  expect(fieldNames).toContain("roadmapUrl");
  expect(fieldNames).toContain("documentationUrl");
  expect(fieldNames).toContain("supportChannel");
});

it("create() stamps all fields with the same HLC (atomic)", async () => {
  await productMutations.create({
    name: "Test Product",
    origin: "bespoke",
    isExternal: false,
    productManagerId: "pm-1",
    teamIds: [],
    componentIds: [],
    createdBy: "user-001",
  });

  const { outbox } = localMutationCommit.mock.calls[0]![0] as {
    outbox: { fields: { hlc: string }[] };
  };
  // create() calls clock.now() once and shares the result — atomic stamping.
  const hlcs = new Set(outbox.fields.map((f) => f.hlc));
  expect(hlcs.size).toBe(1);
  for (const field of outbox.fields) {
    expect(field.hlc).toMatch(/^\d+:\d{4}:.+$/);
  }
});

it("create() throws if name is missing", async () => {
  await expect(
    productMutations.create({
      name: "",
      origin: "bespoke",
      isExternal: false,
      productManagerId: "pm-1",
      teamIds: [],
      componentIds: [],
      createdBy: "user-001",
    })
  ).rejects.toThrow("name is required");
});

// ── update() ────────────────────────────────────────────────────────────────

it("update() routes through localMutation.commit with operation upsert", async () => {
  await productMutations.update("prod-1", { name: "New Name" });

  expect(localMutationCommit).toHaveBeenCalledOnce();
  const { outbox } = localMutationCommit.mock.calls[0]![0] as {
    outbox: { operation: string };
  };
  expect(outbox.operation).toBe("upsert");
});

it("update() sends only changed fields", async () => {
  await productMutations.update("prod-1", {
    name: "New Name",
    origin: "open-source",
  });

  const { outbox } = localMutationCommit.mock.calls[0]![0] as {
    outbox: { fields: { name: string; value: unknown }[] };
  };
  const fieldNames = outbox.fields.map((f) => f.name);
  expect(fieldNames).toContain("name");
  expect(fieldNames).toContain("origin");
  // Fields NOT changed should not be sent
  expect(fieldNames).not.toContain("productManagerId");
  expect(fieldNames).not.toContain("teamIds");
});

it("update() stamps each field with a unique HLC (per-field)", async () => {
  await productMutations.update("prod-1", {
    name: "New Name",
    origin: "open-source",
  });

  const { outbox } = localMutationCommit.mock.calls[0]![0] as {
    outbox: { fields: { hlc: string }[] };
  };
  // update() calls clock.now() per field — per-field stamping.
  const hlcs = outbox.fields.map((f) => f.hlc);
  expect(new Set(hlcs).size).toBe(hlcs.length);
  for (const field of outbox.fields) {
    expect(field.hlc).toMatch(/^\d+:\d{4}:.+$/);
  }
});

it("update() sends empty-string name as a field (not skipped by truthy check)", async () => {
  await productMutations.update("prod-1", { name: "" });

  expect(localMutationCommit).toHaveBeenCalledOnce();
  const { outbox } = localMutationCommit.mock.calls[0]![0] as {
    outbox: { fields: { name: string; value: unknown }[] };
  };
  const nameField = outbox.fields.find((f) => f.name === "name");
  expect(nameField).toBeDefined();
  expect(nameField!.value).toBe("");
});

it("update() does nothing when no changes provided", async () => {
  await productMutations.update("prod-1", {});

  expect(localMutationCommit).not.toHaveBeenCalled();
});

// ── delete() ────────────────────────────────────────────────────────────────

it("delete() uses operation delete", async () => {
  // Mock fetchById to return an archived product
  const { fetchLocalProductRecords } =
    await import("~/services/entity/ProductQueries");
  vi.mocked(fetchLocalProductRecords).mockResolvedValueOnce([
    {
      id: "prod-1",
      subjectId: "prod-1",
      name: "Old Product",
      status: "archived",
      origin: "bespoke",
      isExternal: 0,
      productManagerId: "pm-1",
      engineeringLeadId: null,
      teamIds: "[]",
      componentIds: "[]",
      roadmapUrl: null,
      documentationUrl: null,
      supportChannel: null,
      createdBy: "user-1",
      createdByName: "User",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
      reviewsCount: 0,
    },
  ] as never);

  await productMutations.delete("prod-1", { confirmationName: "Old Product" });

  expect(localMutationCommit).toHaveBeenCalledOnce();
  const { outbox } = localMutationCommit.mock.calls[0]![0] as {
    outbox: { operation: string; fields: unknown[] };
  };
  expect(outbox.operation).toBe("delete");
  // Deletes carry no fields — slice 6 addresses delete semantics
  expect(outbox.fields).toEqual([]);
});

// ── archive() / restore() ───────────────────────────────────────────────────

it("archive() sends status field with operation upsert", async () => {
  const { fetchLocalProductRecords } =
    await import("~/services/entity/ProductQueries");
  vi.mocked(fetchLocalProductRecords).mockResolvedValueOnce([
    {
      id: "prod-1",
      subjectId: "prod-1",
      name: "Product",
      status: "active",
      origin: "bespoke",
      isExternal: 0,
      productManagerId: "pm-1",
      engineeringLeadId: null,
      teamIds: "[]",
      componentIds: "[]",
      roadmapUrl: null,
      documentationUrl: null,
      supportChannel: null,
      createdBy: "user-1",
      createdByName: "User",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
      reviewsCount: 0,
    },
  ] as never);

  await productMutations.archive("prod-1");

  expect(localMutationCommit).toHaveBeenCalledOnce();
  const { outbox } = localMutationCommit.mock.calls[0]![0] as {
    outbox: { operation: string; fields: { name: string; value: unknown }[] };
  };
  expect(outbox.operation).toBe("upsert");
  expect(outbox.fields).toHaveLength(1);
  expect(outbox.fields[0]!.name).toBe("status");
  expect(outbox.fields[0]!.value).toBe("archived");
});

it("restore() sends status field with operation upsert", async () => {
  const { fetchLocalProductRecords } =
    await import("~/services/entity/ProductQueries");
  vi.mocked(fetchLocalProductRecords).mockResolvedValueOnce([
    {
      id: "prod-1",
      subjectId: "prod-1",
      name: "Product",
      status: "archived",
      origin: "bespoke",
      isExternal: 0,
      productManagerId: "pm-1",
      engineeringLeadId: null,
      teamIds: "[]",
      componentIds: "[]",
      roadmapUrl: null,
      documentationUrl: null,
      supportChannel: null,
      createdBy: "user-1",
      createdByName: "User",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
      reviewsCount: 0,
    },
  ] as never);

  await productMutations.restore("prod-1");

  expect(localMutationCommit).toHaveBeenCalledOnce();
  const { outbox } = localMutationCommit.mock.calls[0]![0] as {
    outbox: { fields: { name: string; value: unknown }[] };
  };
  expect(outbox.fields).toHaveLength(1);
  expect(outbox.fields[0]!.name).toBe("status");
  expect(outbox.fields[0]!.value).toBe("active");
});
