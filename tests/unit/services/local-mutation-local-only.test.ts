import { beforeEach, expect, it, vi } from "vitest";
import type * as LocalDb from "~/local-db";
import { LocalMutation } from "~/services/local-mutation";

const triggerPush = vi.hoisted(() => vi.fn());

vi.mock("~/services/sync/pushTrigger", () => ({ triggerPush }));

vi.mock("~/local-db", async (importOriginal) => {
  const actual = await importOriginal<typeof LocalDb>();
  return {
    ...actual,
    getDatabase: vi.fn(),
    isLocalDatabaseReady: vi.fn(() => true),
    waitForLocalDbReady: vi.fn().mockResolvedValue(undefined),
  };
});

type Write = { query: string; params: unknown[] };

function makeDatabase() {
  const committed: Write[] = [];
  return {
    committed,
    database: {
      async transaction(
        callback: (tx: {
          sql: (query: string, ...params: unknown[]) => Promise<void>;
        }) => Promise<void>
      ) {
        const staged: Write[] = [];
        await callback({
          async sql(query, ...params) {
            staged.push({ query, params });
          },
        });
        committed.push(...staged);
      },
    },
  };
}

let getDatabase: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  vi.clearAllMocks();
  const localDb = await import("~/local-db");
  getDatabase = vi.mocked(localDb.getDatabase);
});

it("commits one state-only transaction without triggering transport", async () => {
  const { committed, database } = makeDatabase();
  getDatabase.mockResolvedValue(database);

  await new LocalMutation().localOnly({
    stateWrite: async (tx, { now }) => {
      expect(now).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      await (
        tx as unknown as {
          sql: (query: string, value: string) => Promise<void>;
        }
      ).sql("UPDATE template_revisions SET name = ?", "Draft");
    },
  });

  expect(committed).toEqual([
    {
      query: "UPDATE template_revisions SET name = ?",
      params: ["Draft"],
    },
  ]);
  expect(triggerPush).not.toHaveBeenCalled();
});

it("rolls back the state-only transaction when the write fails", async () => {
  const { committed, database } = makeDatabase();
  getDatabase.mockResolvedValue(database);

  await expect(
    new LocalMutation().localOnly({
      stateWrite: async (tx) => {
        await (
          tx as unknown as {
            sql: (query: string, value: string) => Promise<void>;
          }
        ).sql("UPDATE template_revisions SET name = ?", "Draft");
        throw new Error("state write failed");
      },
    })
  ).rejects.toThrow("state write failed");

  expect(committed).toEqual([]);
});
