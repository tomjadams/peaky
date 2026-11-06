import { z } from "zod";

// ── DB lifecycle ──────────────────────────────────────────────

export const localDbInitializingDataSchema = z.object({
  opfsAvailable: z
    .boolean()
    .describe(
      "True when OPFS is available; false on browsers that fall back to memory storage."
    ),
});
export type LocalDbInitializingData = z.infer<
  typeof localDbInitializingDataSchema
>;

export const localDbReadyDataSchema = z.object({
  coldStartMs: z
    .number()
    .int()
    .nonnegative()
    .describe(
      "Wall-clock duration from the start of bootstrap to the ready signal, in milliseconds."
    ),
  opfsAvailable: z
    .boolean()
    .describe(
      "True when OPFS is available; false on memory-only fallback browsers."
    ),
});
export type LocalDbReadyData = z.infer<typeof localDbReadyDataSchema>;

export const localDbBootstrapStartedDataSchema = z.object({
  isRecreate: z
    .boolean()
    .describe(
      "True when this bootstrap follows a user-triggered recreate-DB reload."
    ),
});
export type LocalDbBootstrapStartedData = z.infer<
  typeof localDbBootstrapStartedDataSchema
>;

export const localDbRecreatedDataSchema = z.object({
  // `z.enum(["user"])` (vs z.literal) signals this field is an enum that
  // can grow additively — future triggers (auto-recreate on corruption,
  // devtools, e2e seed) extend the enum without bumping to v2.
  triggeredBy: z
    .enum(["user"])
    .describe(
      "Origin of the recreate. Currently always 'user' via the /system action."
    ),
});
export type LocalDbRecreatedData = z.infer<typeof localDbRecreatedDataSchema>;

export const localDbMigrationFailedDataSchema = z.object({
  migrationId: z
    .string()
    .describe(
      "Migration ID that failed (e.g. '0007_domain_events_rename_source_values')."
    ),
  errorMessage: z
    .string()
    .describe(
      "Sanitised error message. Stack traces and file paths are stripped before emission."
    ),
});
export type LocalDbMigrationFailedData = z.infer<
  typeof localDbMigrationFailedDataSchema
>;

export const clientSchemaMigratedDataSchema = z.object({
  migrationsApplied: z
    .array(z.string())
    .describe(
      "IDs of the migrations applied in this run, in application order."
    ),
  schemaVersion: z
    .number()
    .int()
    .describe(
      "Total number of standard migrations in the bundle after this run."
    ),
});
export type ClientSchemaMigratedData = z.infer<
  typeof clientSchemaMigratedDataSchema
>;

// ── Storage ───────────────────────────────────────────────────

export const opfsQuotaWarningDataSchema = z.object({
  usageBytes: z
    .number()
    .int()
    .nonnegative()
    .describe("Bytes currently used by Peaky's OPFS storage."),
  quotaBytes: z
    .number()
    .int()
    .nonnegative()
    .describe("Browser-reported quota for the origin, in bytes."),
  usagePct: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe("Rounded percentage of quota used (0..100)."),
});
export type OpfsQuotaWarningData = z.infer<typeof opfsQuotaWarningDataSchema>;

export const opfsStorageMeasuredDataSchema = z.object({
  usageBytes: z
    .number()
    .int()
    .nonnegative()
    .nullable()
    .describe(
      "Bytes used. Null when the Storage Estimation API is unavailable."
    ),
  quotaBytes: z
    .number()
    .int()
    .nonnegative()
    .nullable()
    .describe(
      "Browser-reported quota. Null when the Storage Estimation API is unavailable."
    ),
  supported: z
    .boolean()
    .describe(
      "Whether navigator.storage.estimate() returned a usable measurement."
    ),
});
export type OpfsStorageMeasuredData = z.infer<
  typeof opfsStorageMeasuredDataSchema
>;

// ── Sync operations ───────────────────────────────────────────

export const syncCycleStartedDataSchema = z.object({
  cycleId: z
    .string()
    .describe("UUID generated at cycle start; correlates with end events."),
});
export type SyncCycleStartedData = z.infer<typeof syncCycleStartedDataSchema>;

export const syncCycleSucceededDataSchema = z.object({
  cycleId: z
    .string()
    .describe(
      "Matches the cycleId on the corresponding SyncCycleStarted event."
    ),
  eventsPushed: z
    .number()
    .int()
    .nonnegative()
    .describe("Outbox items pushed in this cycle."),
  eventsPulled: z
    .number()
    .int()
    .nonnegative()
    .describe(
      "Events pulled from the server in this cycle. Always 0 until pull is implemented."
    ),
  durationMs: z
    .number()
    .int()
    .nonnegative()
    .describe("Wall-clock duration of the cycle, in milliseconds."),
});
export type SyncCycleSucceededData = z.infer<
  typeof syncCycleSucceededDataSchema
>;

export const syncCycleFailedDataSchema = z.object({
  cycleId: z
    .string()
    .describe(
      "Matches the cycleId on the corresponding SyncCycleStarted event."
    ),
  errorMessage: z
    .string()
    .describe(
      "Sanitised error message. Stack traces and file paths are stripped before emission."
    ),
  durationMs: z
    .number()
    .int()
    .nonnegative()
    .describe("Wall-clock duration before the failure, in milliseconds."),
});
export type SyncCycleFailedData = z.infer<typeof syncCycleFailedDataSchema>;

export const entitlementsRefreshedDataSchema = z.object({
  hasDowngrades: z
    .boolean()
    .describe(
      "True when the refresh removed at least one previously-granted entitlement."
    ),
  changeCount: z
    .number()
    .int()
    .nonnegative()
    .describe(
      "Total number of entitlement changes applied (additions and removals)."
    ),
});
export type EntitlementsRefreshedData = z.infer<
  typeof entitlementsRefreshedDataSchema
>;
