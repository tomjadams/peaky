import type { getDatabase } from "./client";

/**
 * Single-writer gate for local SQLite transactions.
 *
 * OPFS SQLite has one write connection; SQLocal's Drizzle proxy cannot
 * isolate concurrent `BEGIN`s, so two overlapping transactions — a user
 * mutation racing a sync replay, or two tabs writing at once — throw
 * `Failed query: begin` and can silently corrupt the database (the failure
 * domain modelled in
 * formal_verification/resilience/sqlite_single_writer_coordination.fizz).
 *
 * The Web Locks API is the gate: `navigator.locks.request` queues callers
 * on an origin-scoped named lock, serializing writers WITHIN a tab and
 * ACROSS tabs — the same guarantee the roadmap's SharedWorker sketch was
 * after, without owning a worker lifecycle. The FizzBee invariant holds:
 * at most one transaction is in "writing" at any time.
 *
 * Reads stay ungated — only `BEGIN` contends.
 */
const WRITE_LOCK_NAME = "peaky:sqlite-write";

// Fallback for environments without Web Locks (SSR, unit tests, old
// engines): a promise chain serializes writers within this context.
let fallbackChain: Promise<unknown> = Promise.resolve();

export function withWriteGate<T>(work: () => Promise<T>): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks?.request) {
    return navigator.locks.request(WRITE_LOCK_NAME, () =>
      work()
    ) as Promise<T>;
  }
  // Fallback queue: each writer waits for the previous one to finish, then
  // runs — that's what serializes them. `.catch` keeps the chain alive even
  // when a writer fails, so one failure can't block the writers behind it
  // (and means `fallbackChain` itself never rejects). The caller still sees
  // real errors because we return `run`, not the swallowed chain.
  const run = fallbackChain.then(work);
  fallbackChain = run.catch(() => undefined);
  return run;
}

type LocalDatabase = Awaited<ReturnType<typeof getDatabase>>;
type LocalTransaction = Parameters<
  Parameters<LocalDatabase["transaction"]>[0]
>[0];

/**
 * A Drizzle transaction behind the single-writer gate. Drop-in for
 * `db.transaction(fn)` at every write site:
 *
 *   await withWriteTransaction(db, async (tx) => { ... });
 */
export function withWriteTransaction<T>(
  db: LocalDatabase,
  fn: (tx: LocalTransaction) => Promise<T>
): Promise<T> {
  return withWriteGate(() => db.transaction(fn));
}
