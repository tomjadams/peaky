/**
 * Single-writer gate — serializes local SQLite transactions so concurrent
 * writers (user mutation vs sync replay, tab vs tab) can never interleave
 * BEGINs. Mirrors the FizzBee invariant: at most one writer at a time.
 */
import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
});

async function loadGate() {
  vi.resetModules();
  return import("../../../app/local-db/write-gate");
}

it("serializes overlapping writers — the second never starts before the first finishes", async () => {
  vi.stubGlobal("navigator", {} as Navigator); // no Web Locks → fallback chain
  const { withWriteGate } = await loadGate();

  const order: string[] = [];
  let releaseFirst!: () => void;
  const firstGate = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });

  const first = withWriteGate(async () => {
    order.push("first:start");
    await firstGate;
    order.push("first:end");
    return "A";
  });
  const second = withWriteGate(async () => {
    order.push("second:start");
    return "B";
  });

  // Give the second writer every chance to start early.
  await new Promise((resolve) => setTimeout(resolve, 10));
  expect(order).toEqual(["first:start"]);

  releaseFirst();
  expect(await first).toBe("A");
  expect(await second).toBe("B");
  expect(order).toEqual(["first:start", "first:end", "second:start"]);
});

it("a failing writer does not poison the gate", async () => {
  vi.stubGlobal("navigator", {} as Navigator);
  const { withWriteGate } = await loadGate();

  await expect(
    withWriteGate(async () => {
      throw new Error("boom");
    })
  ).rejects.toThrow("boom");

  await expect(withWriteGate(async () => "ok")).resolves.toBe("ok");
});

it("uses the Web Locks API when available — one origin-wide named lock", async () => {
  const request = vi.fn(
    async (_name: string, work: () => Promise<unknown>) => work()
  );
  vi.stubGlobal("navigator", { locks: { request } } as unknown as Navigator);
  const { withWriteGate } = await loadGate();

  await expect(withWriteGate(async () => 42)).resolves.toBe(42);
  expect(request).toHaveBeenCalledWith(
    "peaky:sqlite-write",
    expect.any(Function)
  );
});

it("withWriteTransaction routes db.transaction through the gate", async () => {
  vi.stubGlobal("navigator", {} as Navigator);
  const { withWriteTransaction } = await loadGate();

  const tx = { marker: true };
  const db = {
    transaction: vi.fn(async (fn: (t: unknown) => Promise<unknown>) => fn(tx)),
  };
  const result = await withWriteTransaction(
    db as never,
    async (t) => (t as typeof tx).marker
  );
  expect(result).toBe(true);
  expect(db.transaction).toHaveBeenCalledTimes(1);
});

it("withWriteTransaction: a failing fn does not poison the gate", async () => {
  vi.stubGlobal("navigator", {} as Navigator); // no Web Locks → fallback chain
  const { withWriteTransaction } = await loadGate();

  const tx = { marker: true };
  const db = {
    transaction: vi.fn(async (fn: (t: unknown) => Promise<unknown>) => fn(tx)),
  };

  // The production call path: a transaction whose body throws must reject…
  await expect(
    withWriteTransaction(db as never, async () => {
      throw new Error("boom");
    })
  ).rejects.toThrow("boom");

  // …without blocking the next writer through the gate.
  await expect(
    withWriteTransaction(db as never, async (t) => (t as typeof tx).marker)
  ).resolves.toBe(true);
  expect(db.transaction).toHaveBeenCalledTimes(2);
});
