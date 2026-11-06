import { beforeEach, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";

const localOnly = vi.hoisted(() => vi.fn());
const draft = vi.hoisted(() => vi.fn());
const getSnapshot = vi.hoisted(() => vi.fn());
const saveSnapshot = vi.hoisted(() => vi.fn());
const updateEntitlement = vi.hoisted(() => vi.fn());

vi.mock("~/services/local-mutation", () => ({
  localMutation: { localOnly, draft },
}));

vi.mock("~/services/entitlement/EntitlementService", () => ({
  EntitlementService: class {
    getSnapshot = getSnapshot;
    saveSnapshot = saveSnapshot;
    updateEntitlement = updateEntitlement;
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

it("installs fixture drafts idempotently through state-only writes", async () => {
  const rowsByTable = new Map<string, Map<string, Record<string, unknown>>>();
  localOnly.mockImplementation(async ({ stateWrite }) => {
    await stateWrite(
      {
        insert: (table: Parameters<typeof getTableName>[0]) => ({
          values: (values: Record<string, unknown>) => ({
            onConflictDoNothing: async () => {
              const tableName = getTableName(table);
              const rows = rowsByTable.get(tableName) ?? new Map();
              rows.set(String(values.id), values);
              rowsByTable.set(tableName, rows);
            },
          }),
        }),
      } as never,
      { now: "2026-08-20T10:00:00.000Z" }
    );
  });
  const { installTemplateFixtureDrafts } =
    await import("~/services/template/TemplateFixtureDraftInstaller");

  await installTemplateFixtureDrafts();
  const countsAfterFirstInstall = new Map(
    [...rowsByTable].map(([table, rows]) => [table, rows.size])
  );
  await installTemplateFixtureDrafts();

  expect(
    new Map([...rowsByTable].map(([table, rows]) => [table, rows.size]))
  ).toEqual(countsAfterFirstInstall);
  expect(rowsByTable.get("templates")?.size).toBe(4);
  expect(rowsByTable.get("template_revisions")?.size).toBe(4);
  expect(
    [...(rowsByTable.get("template_revisions")?.values() ?? [])].every(
      (revision) =>
        revision.status === "draft" &&
        revision.revisionNumber === null &&
        revision.publishedByActorId === null
    )
  ).toBe(true);
  expect(rowsByTable.has("events")).toBe(false);
  expect(rowsByTable.has("local_outbox")).toBe(false);
  expect(localOnly).toHaveBeenCalledTimes(2);
  expect(draft).not.toHaveBeenCalled();
});

it("refreshes an existing snapshot while granting every fixture draft", async () => {
  getSnapshot.mockResolvedValue({
    id: "snapshot-1",
    entitlements: JSON.stringify({
      "review:*": { canEdit: true, canView: true },
    }),
    validUntil: "2026-08-01T00:00:00.000Z",
  });
  const { grantTemplateFixtureDraftAccess } =
    await import("~/services/template/TemplateFixtureDraftInstaller");

  await grantTemplateFixtureDraftAccess("actor-1");

  expect(saveSnapshot).toHaveBeenCalledOnce();
  expect(saveSnapshot).toHaveBeenCalledWith(
    "actor-1",
    expect.objectContaining({
      "review:*": { canEdit: true, canView: true },
      "template:01932b3c-7d00-7000-8000-000000001001": {
        canEdit: true,
        canView: true,
      },
    })
  );
  expect(updateEntitlement).not.toHaveBeenCalled();
});
