/**
 * OPFS storage measurement + event emission.
 *
 * Wraps `navigator.storage.estimate()` (when available) and emits:
 *
 * - `OpfsStorageMeasured.v1` — every measurement, even when the API is
 *   unavailable (`supported: false` so the /system Storage tile can show
 *   "Unknown" rather than disappearing).
 * - `OpfsQuotaWarning.v1` — only when usage > 80% of quota.
 *
 * Both events are flagged `local: true` in the catalog, so they stay on
 * the device by design — quota state is per-browser and meaningless to
 * other actors.
 */

import { emitSystemEvent } from "~/services/events/emitSystemEvent";
import type {
  OpfsQuotaWarning,
  OpfsStorageMeasured,
} from "~/services/events/DomainEvent";
// Imported from the file path (not the ~/local-db barrel) to avoid the
// circular-import path documented in emitSystemEvent.ts.
import { DB_NAME } from "~/local-db/client";

const QUOTA_WARN_THRESHOLD = 0.8;

interface MeasurementResult {
  usageBytes: number | null;
  quotaBytes: number | null;
  supported: boolean;
}

/**
 * Read the actual SQLite file sizes from OPFS.
 *
 * `navigator.storage.estimate().usage` includes ALL origin storage (service
 * worker caches, IndexedDB metadata, etc.) and can be wildly larger than the
 * actual database on some browsers and corporate environments. Reading the
 * files directly gives the true on-disk size of the database.
 *
 * Returns null when the OPFS directory API is unavailable or no matching
 * file exists yet (e.g. very first page load before the DB is written).
 */
async function getOpfsFileBytes(): Promise<number | null> {
  if (
    typeof navigator === "undefined" ||
    typeof navigator.storage?.getDirectory !== "function"
  ) {
    return null;
  }

  try {
    const root = await navigator.storage.getDirectory();
    // Sum the main db file plus WAL and SHM files when present.
    const filenames = [
      `${DB_NAME}.sqlite3`,
      `${DB_NAME}.sqlite3-wal`,
      `${DB_NAME}.sqlite3-shm`,
    ];

    let totalBytes = 0;
    let found = false;

    await Promise.all(
      filenames.map(async (name) => {
        try {
          const handle = await root.getFileHandle(name);
          const file = await handle.getFile();
          totalBytes += file.size;
          found = true;
        } catch {
          // File doesn't exist — normal for WAL/SHM when not in WAL mode.
        }
      })
    );

    return found ? totalBytes : null;
  } catch {
    return null;
  }
}

export async function measureOpfs(): Promise<MeasurementResult> {
  if (
    typeof navigator === "undefined" ||
    typeof navigator.storage?.estimate !== "function"
  ) {
    return { usageBytes: null, quotaBytes: null, supported: false };
  }

  try {
    const [estimate, opfsBytes] = await Promise.all([
      navigator.storage.estimate(),
      getOpfsFileBytes(),
    ]);
    return {
      // Prefer the actual OPFS file size over the broad browser estimate,
      // which inflates usage by including caches and other origin storage.
      usageBytes: opfsBytes ?? estimate.usage ?? null,
      quotaBytes: estimate.quota ?? null,
      supported: true,
    };
  } catch {
    return { usageBytes: null, quotaBytes: null, supported: false };
  }
}

/**
 * Measure OPFS usage and emit `OpfsStorageMeasured.v1` (always) plus
 * `OpfsQuotaWarning.v1` (when usage > 80% of quota).
 *
 * Returns the measurement so callers (e.g. the /system page) can render it
 * without a second round trip through the events table.
 */
export async function measureAndEmitOpfs(): Promise<MeasurementResult> {
  const measurement = await measureOpfs();

  await emitSystemEvent<OpfsStorageMeasured>({
    type: "OpfsStorageMeasured.v1",
    entityId: "opfs",
    data: measurement,
  });

  if (
    measurement.supported &&
    measurement.usageBytes !== null &&
    measurement.quotaBytes !== null &&
    measurement.quotaBytes > 0
  ) {
    const ratio = measurement.usageBytes / measurement.quotaBytes;
    if (ratio > QUOTA_WARN_THRESHOLD) {
      await emitSystemEvent<OpfsQuotaWarning>({
        type: "OpfsQuotaWarning.v1",
        entityId: "opfs",
        data: {
          usageBytes: measurement.usageBytes,
          quotaBytes: measurement.quotaBytes,
          usagePct: Math.round(ratio * 100),
        },
      });
    }
  }

  return measurement;
}
