import * as client from "~/local-db/client";
import * as bootstrap from "~/local-db/bootstrap";
import { migrationLog } from "~/local-db/migration-log";

const LOCAL_STORAGE_CLEAR_FLAG = "peaky-clear-db-on-reload";
const LOCAL_STORAGE_ERROR_KEY = "peaky-db-bootstrap-error";

/**
 * Local database plugin — schedules SQLocal + Drizzle warmup on app startup.
 *
 * Responsibilities:
 *  1. Clears the OPFS database file if the user triggered a reset (flag in localStorage);
 *     surfaces any cleanup failure through the recovery overlay.
 *  2. Warms the database in the background and exposes any bootstrap failure
 *     as a reactive `useState('local-db-error')` so the UI can show a recovery screen.
 *  3. Persists the last bootstrap error to localStorage so the recovery screen
 *     survives a hard reload (the user does not need to open DevTools to get details).
 *  4. Exposes debug helpers on `window.peakyDB`.
 */
async function removeWalSideFiles(
  root: FileSystemDirectoryHandle,
  dbFile: string
) {
  for (const suffix of ["-wal", "-shm", "-journal"]) {
    try {
      await root.removeEntry(`${dbFile}${suffix}`);
    } catch {
      // WAL/SHM files might not exist — ignore
    }
  }
}

export default defineNuxtPlugin({
  name: "local-db",
  async setup() {
    if (import.meta.server) return;

    const isTestEnvironment =
      import.meta.test ||
      (typeof process !== "undefined" && process.env.VITEST === "true");

    // ── 1. Reactive error state ─────────────────────────────────────────────
    // Initialized before the OPFS reset so that a cleanup failure can write
    // to the recovery overlay instead of being silently swallowed.
    const dbError = useState<{
      message: string;
      at: string;
      migrationId?: string;
    } | null>("local-db-error", () => {
      // Restore persisted error from a previous failed session so the
      // recovery screen appears immediately on reload, before warmup finishes.
      const stored = localStorage.getItem(LOCAL_STORAGE_ERROR_KEY);
      if (!stored) return null;
      try {
        return JSON.parse(stored);
      } catch {
        return null;
      }
    });

    // ── 2. Pre-init: clear OPFS if the user requested a reset ──────────────
    const isRecreate =
      !isTestEnvironment &&
      localStorage.getItem(LOCAL_STORAGE_CLEAR_FLAG) === "1";
    if (isRecreate) {
      localStorage.removeItem(LOCAL_STORAGE_CLEAR_FLAG);
      localStorage.removeItem(LOCAL_STORAGE_ERROR_KEY);
      dbError.value = null;

      if (client.isOpfsAvailable()) {
        try {
          const root = await navigator.storage.getDirectory();
          const dbFile = `${client.DB_NAME}.sqlite3`;
          await root.removeEntry(dbFile);
          await removeWalSideFiles(root, dbFile);
          console.info("[local-db] Local database cleared on user request");
        } catch (clearError) {
          const payload = {
            message:
              clearError instanceof Error
                ? clearError.message
                : String(clearError),
            at: new Date().toISOString(),
          };
          dbError.value = payload;
          localStorage.setItem(
            LOCAL_STORAGE_ERROR_KEY,
            JSON.stringify(payload)
          );
          return;
        }
      }
    }
    // Hand the recreate signal to bootstrap so it can emit the matching
    // LocalDbBootstrapStarted/LocalDbRecreated system events once the DB and
    // events table are ready to persist them.
    bootstrap.setBootstrapContext({ isRecreate });

    // ── 3. OPFS availability warning ────────────────────────────────────────
    if (!client.isOpfsAvailable()) {
      console.warn(
        "[local-db] OPFS not available - local persistence will not work across sessions"
      );
    }

    // ── 4. Background warmup with error callback ─────────────────────────────
    if (!isTestEnvironment) {
      bootstrap.warmLocalDatabaseInBackground({
        onReady: () => {
          // Clear any persisted error from a previous failed session.
          if (dbError.value !== null) {
            dbError.value = null;
            localStorage.removeItem(LOCAL_STORAGE_ERROR_KEY);
          }
        },
        onError: (error) => {
          const payload = {
            message: error.message,
            at: new Date().toISOString(),
          };
          dbError.value = payload;
          // Persist so the recovery UI is visible immediately after a hard reload.
          localStorage.setItem(
            LOCAL_STORAGE_ERROR_KEY,
            JSON.stringify(payload)
          );
        },
      });
    }

    // ── 5. Debug helpers on window.peakyDB ──────────────────────────────────
    // Gated via runtime config (true in local dev + Vercel preview, false in
    // real production) so E2E tests on preview deployments can call peakyDB
    // helpers (e.g. `peakyDB.dumpTable`) the same way they call them locally.
    if (
      typeof window !== "undefined" &&
      useRuntimeConfig().public.testHelpersEnabled
    ) {
      (window as unknown as Record<string, unknown>).peakyDB = {
        isOpen: bootstrap.isLocalDatabaseReady,

        async getDB() {
          await bootstrap.ensureLocalDatabaseReady();
          return client.getDatabase();
        },

        async getSQLocal() {
          await bootstrap.ensureLocalDatabaseReady();
          return client.getSQLocal();
        },

        async dumpTable(tableName: string, limit = 100) {
          await bootstrap.ensureLocalDatabaseReady();
          const sqlocal = await client.getSQLocal();
          return sqlocal.exec(`SELECT * FROM ${tableName} LIMIT ?`, [limit]);
        },

        async getTables() {
          await bootstrap.ensureLocalDatabaseReady();
          const sqlocal = await client.getSQLocal();
          return sqlocal.sql<{ name: string }>`
          SELECT name FROM sqlite_master
          WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'schema_%'
        `;
        },

        async stats() {
          await bootstrap.ensureLocalDatabaseReady();
          const sqlocal = await client.getSQLocal();
          const tables = await sqlocal.sql<{ name: string }>`
          SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
        `;
          const stats: Record<string, number> = {};
          for (const table of tables) {
            const rows = await sqlocal.exec(
              `SELECT COUNT(*) as count FROM ${table.name}`,
              []
            );
            const count =
              "rows" in rows && Array.isArray(rows.rows) && rows.rows[0]
                ? (rows.rows[0] as { count: number }).count
                : 0;
            stats[table.name] = count;
          }
          return stats;
        },

        async migrationLog() {
          await bootstrap.ensureLocalDatabaseReady();
          return migrationLog.read();
        },

        /**
         * Clear the local database and reload.
         * Sets a flag in localStorage; the plugin clears OPFS on next startup
         * before the database is initialised (no lock conflict).
         */
        clearLocalData() {
          localStorage.setItem(LOCAL_STORAGE_CLEAR_FLAG, "1");
          window.location.reload();
        },
      };

      console.log(
        "[local-db] Debug helpers available at window.peakyDB\n" +
          "  peakyDB.isOpen()           - check if DB is ready\n" +
          "  peakyDB.stats()            - row counts per table\n" +
          "  peakyDB.dumpTable('...')   - dump table contents\n" +
          "  peakyDB.getTables()        - list all tables\n" +
          "  peakyDB.migrationLog()     - view migration audit log\n" +
          "  peakyDB.clearLocalData()   - clear DB and reload"
      );
    }
  },
});
