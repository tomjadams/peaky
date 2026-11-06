import * as client from "./client";
import * as migrations from "./migrations";
import { scheduleWhenBrowserIdle } from "~/utils/schedule";
import { emitSystemEvent } from "~/services/events/emitSystemEvent";
import type {
  LocalDbBootstrapStarted,
  LocalDbInitializing,
  LocalDbReady,
  LocalDbRecreated,
} from "~/services/events/DomainEvent";

let databaseReady = false;
let databaseBootstrapPromise: Promise<void> | null = null;

/**
 * Bootstrap context carried in from the plugin layer (recreate-DB signal).
 * The plugin owns the LOCAL_STORAGE_CLEAR_FLAG read; bootstrap.ts owns the
 * resulting events because they need the DB ready before they can persist.
 */
interface BootstrapContext {
  isRecreate: boolean;
}
let bootstrapContext: BootstrapContext = { isRecreate: false };

export function setBootstrapContext(context: BootstrapContext): void {
  bootstrapContext = context;
}

async function bootstrapLocalDatabaseOnce(): Promise<void> {
  const opfsAvailable = client.isOpfsAvailable();
  const startedAt = performance.now();

  // Emitted before any DB I/O. On fresh installs the events table does not
  // yet exist so this emit silently fails — acceptable degradation; on every
  // subsequent bootstrap it succeeds.
  await emitSystemEvent<LocalDbInitializing>({
    type: "LocalDbInitializing.v1",
    entityId: "client",
    data: { opfsAvailable },
  });

  await client.getDatabase();
  await migrations.initializeDatabase();
  databaseReady = true;

  // BootstrapStarted carries the recreate signal originated from the
  // plugin's LOCAL_STORAGE_CLEAR_FLAG read. Emitted post-migrations
  // (so the events table is guaranteed to exist), so its `time` reflects
  // a post-migration moment, not plugin entry. Acceptable trade — the
  // recreate flag is the authoritative signal, not the timestamp.
  await emitSystemEvent<LocalDbBootstrapStarted>({
    type: "LocalDbBootstrapStarted.v1",
    entityId: "client",
    data: { isRecreate: bootstrapContext.isRecreate },
  });

  await emitSystemEvent<LocalDbReady>({
    type: "LocalDbReady.v1",
    entityId: "client",
    data: {
      coldStartMs: Math.round(performance.now() - startedAt),
      opfsAvailable,
    },
  });

  if (bootstrapContext.isRecreate) {
    await emitSystemEvent<LocalDbRecreated>({
      type: "LocalDbRecreated.v1",
      entityId: "client",
      data: { triggeredBy: "user" },
    });
    // Reset so a subsequent in-process bootstrap (unlikely; tests) doesn't
    // re-emit Recreated.
    bootstrapContext = { isRecreate: false };
  }
}

export function isLocalDatabaseReady(): boolean {
  return databaseReady;
}

export async function ensureLocalDatabaseReady(): Promise<void> {
  if (databaseReady) {
    return;
  }

  if (!databaseBootstrapPromise) {
    databaseBootstrapPromise = bootstrapLocalDatabaseOnce().catch((error) => {
      databaseBootstrapPromise = null;
      databaseReady = false;
      throw error;
    });
  }

  await databaseBootstrapPromise;
}

export function warmLocalDatabaseInBackground(callbacks?: {
  onReady?: () => void;
  onError?: (error: Error) => void;
}): void {
  scheduleWhenBrowserIdle(
    () =>
      ensureLocalDatabaseReady()
        .then(() => callbacks?.onReady?.())
        .catch((error) => {
          console.error("[local-db] Failed to initialize database:", error);
          callbacks?.onError?.(
            error instanceof Error ? error : new Error(String(error))
          );
        }),
    {
      timeoutMs: 3000,
    }
  );
}
