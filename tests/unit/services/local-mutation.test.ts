import { beforeEach, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import type * as LocalDb from "~/local-db";
import { LocalMutation } from "~/services/local-mutation";
import type { DomainEvent } from "~/services/events/DomainEvent";

// ── In-memory transaction helper ──────────────────────────────
// Simulates the Drizzle ORM transaction API with real rollback semantics.
// Each test gets a fresh set of recorded writes.

type WriteRecord = { query: string; params: unknown };

/**
 * Build a fake Drizzle `tx` object that records `insert(table).values(data)`
 * calls as `{ query: tableName, params: data }`.
 *
 * Also supports a raw `sql(query, ...params)` method so that test-authored
 * stateWrite callbacks can trigger a traceable write without needing real
 * Drizzle table objects.
 */
function makeFakeTx(
  staged: WriteRecord[],
  opts?: { throwOnCall?: number; callCounter?: { count: number } }
) {
  return {
    insert(table: unknown) {
      return {
        values(data: unknown) {
          const callNum = opts?.callCounter
            ? ++opts.callCounter.count
            : undefined;
          if (opts?.throwOnCall !== undefined && callNum === opts.throwOnCall) {
            throw new Error(
              callNum === opts.throwOnCall
                ? opts.throwOnCall === 2
                  ? "event insert failed"
                  : "outbox insert failed"
                : "insert failed"
            );
          }
          const tableName =
            typeof table === "object" && table !== null
              ? getTableName(table as Parameters<typeof getTableName>[0])
              : String(table);
          staged.push({ query: tableName, params: data });
          const result = Promise.resolve();
          return Object.assign(result, {
            onConflictDoNothing: () => result,
          });
        },
      };
    },
    delete(_table: unknown) {
      return {
        where() {
          return Promise.resolve();
        },
      };
    },
    // Convenience for test-authored stateWrite callbacks
    sql(query: string, ...params: unknown[]) {
      const callNum = opts?.callCounter ? ++opts.callCounter.count : undefined;
      if (opts?.throwOnCall !== undefined && callNum === opts.throwOnCall) {
        throw new Error("state write failed");
      }
      staged.push({ query, params });
      return Promise.resolve();
    },
  };
}

function makeFakeDb() {
  const committed: WriteRecord[] = [];

  return {
    committed,
    fakeDb: {
      async transaction(
        fn: (tx: ReturnType<typeof makeFakeTx>) => Promise<void>
      ) {
        const staged: WriteRecord[] = [];
        const tx = makeFakeTx(staged);
        await fn(tx);
        // All staged writes committed only on success (fn throws → staged not pushed)
        committed.push(...staged);
      },
    },
  };
}

vi.mock("~/local-db", async (importOriginal) => {
  const actual = await importOriginal<typeof LocalDb>();
  return {
    ...actual,
    getDatabase: vi.fn(),
    getSQLocal: vi.fn(),
    createUuidV7: vi.fn(() => "uuid-v7-outbox-test"),
    // Readiness guard: return true so tests don't wait for real DB bootstrap
    isLocalDatabaseReady: vi.fn(() => true),
    waitForLocalDbReady: vi.fn().mockResolvedValue(undefined),
  };
});

// Catalog flag controls the persisted status. Default is `false` (events
// flow through `status: "pending"`). Individual tests override the mock when
// they need to exercise the `local: true` branch.
vi.mock("~/services/events/schemas", () => ({
  isLocalCatalogEvent: vi.fn(() => false),
}));

function makeEvent(id = "evt_abc"): DomainEvent {
  return {
    id,
    type: "ReviewAnswerRecorded.v1",
    specversion: "1.0",
    source: "peaky.client",
    actorId: "user-001",
    actorType: "user",
    entityType: "review_answer",
    entityId: "review-1:q-1",
    time: "2026-03-26T10:00:00.000Z",
    data: { questionId: "q-1", answer: "yes" },
  } as DomainEvent;
}

let getDatabase: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  vi.clearAllMocks();
  const localDb = await import("~/local-db");
  getDatabase = vi.mocked(localDb.getDatabase);
});

it("when all three writes succeed: state, event, and outbox are all persisted", async () => {
  const { committed, fakeDb } = makeFakeDb();
  getDatabase.mockResolvedValue(fakeDb);

  const mutation = new LocalMutation();
  const event = makeEvent("evt_success");

  const stateWriteCalled: boolean[] = [];
  await mutation.commit({
    stateWrite: async (tx) => {
      stateWriteCalled.push(true);
      await (tx as ReturnType<typeof makeFakeTx>).sql(
        "INSERT INTO review_answer_state VALUES (?)",
        "answer-1"
      );
    },
    event,
    outbox: {
      entityType: "review_answer",
      entityId: "review-1:q-1",
      operation: "upsert",
      fields: [],
    },
  });

  expect(stateWriteCalled).toHaveLength(1);
  // state write + events insert + local_outbox insert
  expect(committed).toHaveLength(3);
  expect(committed[0]!.query).toContain("review_answer_state");
  expect(committed[1]!.query).toContain("events");
  expect(committed[2]!.query).toContain("local_outbox");
});

it("returns { eventId } matching the event's id on success", async () => {
  const { fakeDb } = makeFakeDb();
  getDatabase.mockResolvedValue(fakeDb);

  const mutation = new LocalMutation();
  const event = makeEvent("evt_return_id");

  const result = await mutation.commit({
    stateWrite: async (_tx) => {},
    event,
    outbox: {
      entityType: "review_answer",
      entityId: "id",
      operation: "upsert",
      fields: [],
    },
  });

  expect(result).toEqual({ eventId: "evt_return_id" });
});

it("when state write throws: event and outbox are NOT persisted", async () => {
  const { committed, fakeDb } = makeFakeDb();
  getDatabase.mockResolvedValue(fakeDb);

  const mutation = new LocalMutation();
  const event = makeEvent("evt_state_fail");

  await expect(
    mutation.commit({
      stateWrite: async (_tx) => {
        throw new Error("state write failed");
      },
      event,
      outbox: {
        entityType: "review_answer",
        entityId: "id",
        operation: "upsert",
        fields: [],
      },
    })
  ).rejects.toThrow("state write failed");

  // Nothing committed because the transaction rolled back
  expect(committed).toHaveLength(0);
});

it("when event insert throws: state and outbox are NOT persisted", async () => {
  const committed: WriteRecord[] = [];

  // stateWrite makes 1 sql call, then events INSERT is call 2.
  // Throw on call 2 to simulate the audit event insert failing.
  const callCounter = { count: 0 };
  const fakeDb = {
    async transaction(
      fn: (tx: ReturnType<typeof makeFakeTx>) => Promise<void>
    ) {
      const staged: WriteRecord[] = [];
      // throwOnCall=2: first call is stateWrite's sql(), second is events insert
      const tx = makeFakeTx(staged, { throwOnCall: 2, callCounter });
      // Override the insert().values() error message to match expectation
      const origInsert = tx.insert.bind(tx);
      tx.insert = (table: unknown) => {
        const chain = origInsert(table);
        chain.values = (data: unknown) => {
          callCounter.count++;
          if (callCounter.count === 2) {
            throw new Error("event insert failed");
          }
          staged.push({ query: "events_or_outbox", params: data });
          return Promise.resolve();
        };
        return chain;
      };
      // Reset counter override — use a clean approach below
      await fn(tx);
      committed.push(...staged);
    },
  };

  getDatabase.mockResolvedValue(fakeDb);
  const mutation = new LocalMutation();
  const event = makeEvent("evt_event_fail");

  await expect(
    mutation.commit({
      // stateWrite does one sql call, making events the 2nd overall call
      stateWrite: async (tx) => {
        await (tx as ReturnType<typeof makeFakeTx>).sql(
          "INSERT INTO review_answer_state VALUES (?)",
          "state-1"
        );
      },
      event,
      outbox: {
        entityType: "review_answer",
        entityId: "id",
        operation: "upsert",
        fields: [],
      },
    })
  ).rejects.toThrow("event insert failed");

  expect(committed).toHaveLength(0);
});

it("when outbox insert throws: state and event are NOT persisted", async () => {
  const committed: WriteRecord[] = [];

  // With no stateWrite sql calls: events is insert #1, local_outbox is insert #2.
  // Throw on the 2nd insert to simulate the outbox insert failing.
  let insertCount = 0;
  const fakeDb = {
    async transaction(
      fn: (tx: ReturnType<typeof makeFakeTx>) => Promise<void>
    ) {
      const staged: WriteRecord[] = [];
      const tx = {
        insert(table: unknown) {
          return {
            values(data: unknown) {
              insertCount++;
              if (insertCount === 2) {
                throw new Error("outbox insert failed");
              }
              const tableName =
                typeof table === "object" && table !== null
                  ? getTableName(table as Parameters<typeof getTableName>[0])
                  : String(table);
              staged.push({ query: tableName, params: data });
              return Promise.resolve();
            },
          };
        },
        sql(query: string, ...params: unknown[]) {
          staged.push({ query, params });
          return Promise.resolve();
        },
      };
      await fn(tx as unknown as ReturnType<typeof makeFakeTx>);
      committed.push(...staged);
    },
  };

  getDatabase.mockResolvedValue(fakeDb);
  const mutation = new LocalMutation();
  const event = makeEvent("evt_outbox_fail");

  await expect(
    mutation.commit({
      stateWrite: async (_tx) => {},
      event,
      outbox: {
        entityType: "review_answer",
        entityId: "id",
        operation: "upsert",
        fields: [],
      },
    })
  ).rejects.toThrow("outbox insert failed");

  expect(committed).toHaveLength(0);
});

it("multiple concurrent commits don't corrupt each other", async () => {
  const allCommitted: WriteRecord[][] = [];

  // Each transaction call gets its own isolated staging area
  const fakeDb = {
    async transaction(
      fn: (tx: ReturnType<typeof makeFakeTx>) => Promise<void>
    ) {
      const staged: WriteRecord[] = [];
      allCommitted.push(staged);
      await fn(makeFakeTx(staged));
    },
  };

  getDatabase.mockResolvedValue(fakeDb);

  const mutation = new LocalMutation();
  const events = ["evt_c1", "evt_c2", "evt_c3"].map(makeEvent);

  const results = await Promise.all(
    events.map((event) =>
      mutation.commit({
        stateWrite: async (_tx) => {},
        event,
        outbox: {
          entityType: "review_answer",
          entityId: event.entityId,
          operation: "upsert",
          fields: [],
        },
      })
    )
  );

  expect(results).toHaveLength(3);
  expect(results.map((r) => r.eventId)).toEqual(["evt_c1", "evt_c2", "evt_c3"]);
  // 3 separate transaction staging areas
  expect(allCommitted).toHaveLength(3);
});

it("persists the full CloudEvents envelope — no silent drops", async () => {
  const { committed, fakeDb } = makeFakeDb();
  getDatabase.mockResolvedValue(fakeDb);

  const mutation = new LocalMutation();
  const event = {
    ...makeEvent("evt_full_envelope"),
    dataschema:
      "https://orr-sample.example/schemas/ReviewAnswerRecorded.v1.json",
    clientId: "client-session-abc",
    reviewId: "review-1",
  } as DomainEvent;

  await mutation.commit({
    stateWrite: async (_tx) => {},
    event,
    outbox: {
      entityType: "review_answer",
      entityId: "review-1:q-1",
      operation: "upsert",
      fields: [],
    },
  });

  // committed[0] = events insert (no stateWrite ran), committed[1] = local_outbox.
  const eventsInsert = committed[0]!.params as Record<string, unknown>;

  expect(eventsInsert).toMatchObject({
    id: "evt_full_envelope",
    specversion: "1.0",
    dataschema:
      "https://orr-sample.example/schemas/ReviewAnswerRecorded.v1.json",
    reviewId: "review-1",
    eventType: "ReviewAnswerRecorded.v1",
    actorType: "user",
    actorId: "user-001",
    clientId: "client-session-abc",
    time: "2026-03-26T10:00:00.000Z",
    source: "peaky.client",
    entityType: "review_answer",
    entityId: "review-1:q-1",
  });
  // status is catalog-derived; default mock returns false → "pending"
  expect(eventsInsert).toMatchObject({ status: "pending" });
  // data is JSON-stringified payload
  expect(JSON.parse(eventsInsert.data as string)).toEqual({
    questionId: "q-1",
    answer: "yes",
  });
});

it("optional envelope fields fall back to null when undefined on the event", async () => {
  const { committed, fakeDb } = makeFakeDb();
  getDatabase.mockResolvedValue(fakeDb);

  const mutation = new LocalMutation();
  // Bare event — no dataschema, clientId, or reviewId set.
  const event = makeEvent("evt_minimal");

  await mutation.commit({
    stateWrite: async (_tx) => {},
    event,
    outbox: {
      entityType: "review_answer",
      entityId: "id",
      operation: "upsert",
      fields: [],
    },
  });

  const eventsInsert = committed[0]!.params as Record<string, unknown>;

  expect(eventsInsert.dataschema).toBeNull();
  expect(eventsInsert.clientId).toBeNull();
  expect(eventsInsert.reviewId).toBeNull();
});

it("catalog `local: true` ⇒ event row inserted with status='local'", async () => {
  const schemas = await import("~/services/events/schemas");
  vi.mocked(schemas.isLocalCatalogEvent).mockReturnValueOnce(true);

  const { committed, fakeDb } = makeFakeDb();
  getDatabase.mockResolvedValue(fakeDb);

  const mutation = new LocalMutation();
  await mutation.commit({
    stateWrite: async (_tx) => {},
    event: makeEvent("evt_local_flag"),
    outbox: {
      entityType: "review_answer",
      entityId: "id",
      operation: "upsert",
      fields: [],
    },
  });

  const eventsInsert = committed[0]!.params as Record<string, unknown>;
  expect(eventsInsert.status).toBe("local");
});

it("catalog without `local` flag ⇒ event row inserted with status='pending'", async () => {
  const { committed, fakeDb } = makeFakeDb();
  getDatabase.mockResolvedValue(fakeDb);

  const mutation = new LocalMutation();
  await mutation.commit({
    stateWrite: async (_tx) => {},
    event: makeEvent("evt_default_flag"),
    outbox: {
      entityType: "review_answer",
      entityId: "id",
      operation: "upsert",
      fields: [],
    },
  });

  const eventsInsert = committed[0]!.params as Record<string, unknown>;
  expect(eventsInsert.status).toBe("pending");
});

// ── draft() ────────────────────────────────────────────────────────────────

it("draft() writes state + outbox, NO audit event", async () => {
  const { committed, fakeDb } = makeFakeDb();
  getDatabase.mockResolvedValue(fakeDb);

  const mutation = new LocalMutation();
  await mutation.draft({
    stateWrite: async (tx) => {
      await (tx as ReturnType<typeof makeFakeTx>).sql(
        "INSERT INTO review_answer_state VALUES (?)",
        "a"
      );
    },
    outbox: {
      entityType: "review_answer",
      entityId: "r:q",
      operation: "upsert",
      fields: [],
    },
  });

  const tables = committed.map((r) => r.query);
  expect(tables).toContain("local_outbox");
  // No audit event
  expect(tables).not.toContain("events");
  // State write ran
  expect(tables).toContain("INSERT INTO review_answer_state VALUES (?)");
});

it("draft() outbox row has status='pending' and serialized fields", async () => {
  const { committed, fakeDb } = makeFakeDb();
  getDatabase.mockResolvedValue(fakeDb);

  const mutation = new LocalMutation();
  const fields = [{ name: "answer", value: "yes", hlc: "1000:0001:u1" }];
  await mutation.draft({
    stateWrite: async (_tx) => {},
    outbox: {
      entityType: "review_answer",
      entityId: "r:q",
      operation: "upsert",
      fields,
    },
  });

  const outboxRow = committed.find((r) => r.query === "local_outbox")!
    .params as Record<string, unknown>;
  expect(outboxRow.status).toBe("pending");
  expect(outboxRow.entityType).toBe("review_answer");
  expect(outboxRow.entityId).toBe("r:q");
  const parsed = JSON.parse(outboxRow.fields as string) as unknown;
  expect(parsed).toEqual(fields);
});

// ── replay() ───────────────────────────────────────────────────────────────

it("replay() writes state + event with status='synced' and source='peaky.sync'", async () => {
  const { committed, fakeDb } = makeFakeDb();
  getDatabase.mockResolvedValue(fakeDb);

  const mutation = new LocalMutation();
  await mutation.replay({
    stateWrite: async (tx) => {
      await (tx as ReturnType<typeof makeFakeTx>).sql(
        "INSERT INTO review_answer_state VALUES (?)",
        "b"
      );
    },
    event: {
      id: "evt_replay_1",
      type: "ReviewAnswerSynced.v1",
      specversion: "1.0",
      source: "peaky.sync",
      actorId: "user-001",
      actorType: "user",
      entityType: "review_answer",
      entityId: "r:q",
      time: "2026-03-26T10:00:00.000Z",
      data: {},
    },
  });

  const tables = committed.map((r) => r.query);
  expect(tables).toContain("events");
  expect(tables).not.toContain("local_outbox");

  const eventsRow = committed.find((r) => r.query === "events")!
    .params as Record<string, unknown>;
  expect(eventsRow.status).toBe("synced");
  expect(eventsRow.source).toBe("peaky.sync");
});

it("replay() returns { eventId } matching the provided event id", async () => {
  const { fakeDb } = makeFakeDb();
  getDatabase.mockResolvedValue(fakeDb);

  const mutation = new LocalMutation();
  const result = await mutation.replay({
    stateWrite: async (_tx) => {},
    event: {
      id: "evt_replay_id_check",
      type: "ReviewAnswerSynced.v1",
      specversion: "1.0",
      source: "peaky.sync",
      actorId: "u1",
      actorType: "user",
      entityType: "review_answer",
      entityId: "r:q",
      time: "2026-03-26T10:00:00.000Z",
      data: {},
    },
  });

  expect(result.eventId).toBe("evt_replay_id_check");
});
