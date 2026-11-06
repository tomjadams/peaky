/**
 * Inbound sync handler for Advisor override transitions
 * (maturity-score/REQ-016; local-first/REQ-011; AC-018): pulled
 * `review_maturity_override` events append into the group-4 SQLite table
 * through the group-4 row codec. The stream is append-only — a replayed
 * stable transition ID inserts nothing twice, and the effective override
 * resolves on read as the latest non-revoked transition.
 */
import { beforeEach, expect, it, vi } from "vitest";

const replayMock = vi.fn().mockResolvedValue({ eventId: "replayed" });

vi.mock("~/services/local-mutation", () => ({
  localMutation: { replay: replayMock },
}));

vi.mock("~/local-db", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    nowISO: vi.fn(() => "2026-09-10T10:00:00.000Z"),
    createUuidV7: vi.fn(() => "uuid-test"),
  };
});

vi.mock("#shared/db/schema", () => ({
  reviewMaturityOverrides: {
    _: { name: "review_maturity_overrides" },
    id: "id",
  },
  fieldVersions: {
    _: { name: "field_versions" },
    entityType: "entity_type",
    entityId: "entity_id",
    fieldName: "field_name",
  },
  fieldVersionEvents: {
    _: { name: "field_version_events" },
    eventId: "event_id",
    entityType: "entity_type",
    entityId: "entity_id",
    fieldName: "field_name",
    updatedAt: "updated_at",
    id: "id",
  },
}));

type CapturedInsert = {
  table: string;
  row: Record<string, unknown>;
  didNothing?: boolean;
};

function makeTx() {
  const inserts: CapturedInsert[] = [];
  const tx = {
    insert(table: { _: { name: string } }) {
      return {
        values(row: Record<string, unknown>) {
          const entry: CapturedInsert = { table: table._.name, row };
          inserts.push(entry);
          return {
            onConflictDoNothing() {
              entry.didNothing = true;
              return Promise.resolve();
            },
          };
        },
      };
    },
    select() {
      return {
        from() {
          return {
            where() {
              return {
                limit: () => Promise.resolve([]),
                orderBy: () => ({ limit: () => Promise.resolve([]) }),
              };
            },
          };
        },
      };
    },
  };
  return { tx, inserts };
}

async function runStateWrite(callIndex = 0): Promise<CapturedInsert[]> {
  const { tx, inserts } = makeTx();
  const stateWrite = replayMock.mock.calls[callIndex]?.[0]?.stateWrite as
    | ((tx: unknown) => Promise<void>)
    | undefined;
  if (stateWrite) await stateWrite(tx);
  return inserts;
}

function overrideEvent(
  id: string,
  action: string,
  fields: Record<string, unknown> = {}
) {
  const base: Record<string, unknown> = {
    templateRevisionId: "rev-a",
    action,
    priorTransitionId: null,
    occurredAt: "2026-09-10T10:00:00.000Z",
    ...(action === "revoke"
      ? { reviewedPercent: null, reviewedStage: null, explanation: null }
      : {
          reviewedPercent: 55,
          reviewedStage: 3,
          explanation: "Evidence reviewed on site",
        }),
    evidence: action === "revoke" ? [] : ["ev-1"],
    ...fields,
  };
  return {
    id,
    entityType: "review_maturity_override",
    entityId: `review_maturity_override:review-1/${id}`,
    operation: "upsert",
    actorId: "actor-advisor",
    fields: Object.entries(base).map(([name, value]) => ({
      name,
      value: value === null ? null : JSON.stringify(value),
      hlc: "h",
    })),
    time: "2026-09-10T10:00:00.000Z",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

it("ReviewMaturityOverrideHandler appends the transition via the codec", async () => {
  const { ReviewMaturityOverrideHandler } =
    await import("../../../../app/services/sync/inbound/ReviewMaturityOverrideHandler");

  await ReviewMaturityOverrideHandler.handle(overrideEvent("ov-1", "create"));

  expect(replayMock).toHaveBeenCalledOnce();
  expect(replayMock.mock.calls[0]![0].event).toMatchObject({
    type: "ReviewMaturityOverrideSynced.v1",
    reviewId: "review-1",
  });
  const inserts = await runStateWrite();
  const row = inserts.find((i) => i.table === "review_maturity_overrides")!;
  expect(row.row).toMatchObject({
    id: "ov-1",
    reviewId: "review-1",
    templateRevisionId: "rev-a", // opaque pass-through, never parsed
    action: "create",
    reviewedPercent: 55,
    reviewedStage: 3,
    explanation: "Evidence reviewed on site",
    priorTransitionId: null,
    actorId: "actor-advisor",
  });
  expect(JSON.parse(row.row.evidence as string)).toEqual(["ev-1"]);
  // Stable transition IDs are idempotent on replay (AC-018).
  expect(row.didNothing).toBe(true);
});

it("a replayed override event cannot duplicate history", async () => {
  const { ReviewMaturityOverrideHandler } =
    await import("../../../../app/services/sync/inbound/ReviewMaturityOverrideHandler");

  const event = overrideEvent("ov-replay", "create");
  await ReviewMaturityOverrideHandler.handle(event);
  await ReviewMaturityOverrideHandler.handle(event);

  // Both replays run, but each insert is ON CONFLICT DO NOTHING keyed by the
  // stable transition ID — the second application is a no-op at the table.
  expect(replayMock).toHaveBeenCalledTimes(2);
  for (let call = 0; call < 2; call++) {
    const inserts = await runStateWrite(call);
    const row = inserts.find((i) => i.table === "review_maturity_overrides")!;
    expect(row.row.id).toBe("ov-replay");
    expect(row.didNothing).toBe(true);
  }
});

it("the effective override resolves on read as the latest non-revoked transition", async () => {
  const { ReviewMaturityOverrideHandler } =
    await import("../../../../app/services/sync/inbound/ReviewMaturityOverrideHandler");
  const { overrideTransitionFromRow } =
    await import("../../../../app/services/maturity/overridePersistence");
  const { resolveEffectiveOverride } =
    await import("../../../../app/services/maturity/override");

  await ReviewMaturityOverrideHandler.handle(
    overrideEvent("ov-1", "create", { occurredAt: "2026-09-01T09:00:00Z" })
  );
  await ReviewMaturityOverrideHandler.handle(
    overrideEvent("ov-2", "revoke", {
      occurredAt: "2026-09-02T09:00:00Z",
      priorTransitionId: "ov-1",
    })
  );

  const rows: Record<string, unknown>[] = [];
  for (let call = 0; call < 2; call++) {
    const inserts = await runStateWrite(call);
    rows.push(
      inserts.find((i) => i.table === "review_maturity_overrides")!.row
    );
  }
  const history = rows.map((row) => overrideTransitionFromRow(row as never));
  expect(resolveEffectiveOverride(history, "review-1", "rev-a")).toBeNull();
  // A scope on a different Revision never leaks (exact opaque comparison).
  expect(resolveEffectiveOverride(history, "review-1", "rev-b")).toBeNull();
  expect(history).toHaveLength(2);
});

it("ReviewMaturityOverrideHandler skips malformed transitions", async () => {
  const { ReviewMaturityOverrideHandler } =
    await import("../../../../app/services/sync/inbound/ReviewMaturityOverrideHandler");

  // Unknown action.
  await ReviewMaturityOverrideHandler.handle(overrideEvent("ov-x", "delete"));
  // Out-of-range stage violates the stored invariant the codec enforces.
  await ReviewMaturityOverrideHandler.handle(
    overrideEvent("ov-y", "create", { reviewedStage: 9 })
  );
  // Missing templateRevisionId — the Revision key is required.
  await ReviewMaturityOverrideHandler.handle(
    overrideEvent("ov-z", "create", { templateRevisionId: undefined })
  );
  // Malformed entity ID (missing type prefix).
  const badId = overrideEvent("ov-w", "create");
  badId.entityId = "ov-w";
  await ReviewMaturityOverrideHandler.handle(badId);
  // Deletes never apply to the append-only stream.
  await ReviewMaturityOverrideHandler.handle({
    ...overrideEvent("ov-del", "revoke"),
    operation: "delete",
  });

  expect(replayMock).not.toHaveBeenCalled();
});

it("dispatchInboundEvent routes review_maturity_override", async () => {
  const { dispatchInboundEvent } =
    await import("../../../../app/services/sync/inbound/index");

  await dispatchInboundEvent(overrideEvent("ov-route", "create"));

  expect(replayMock).toHaveBeenCalledOnce();
  expect(
    (replayMock.mock.calls[0]![0] as { event: { type: string } }).event.type
  ).toBe("ReviewMaturityOverrideSynced.v1");
});
