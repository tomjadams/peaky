/**
 * Local-first database module.
 *
 * Provides SQLocal + Drizzle ORM for browser-local durable storage.
 * This is the client's source of truth for first-party editing domains.
 *
 * @see site/docs/development/walkthroughs/local-first-architecture.md
 */

// Configuration
export { DB_NAME } from "./client";
export { SCHEMA_VERSION } from "./migrations";
export {
  ensureLocalDatabaseReady,
  isLocalDatabaseReady,
  warmLocalDatabaseInBackground,
} from "./bootstrap";

// Database client
export {
  isOpfsAvailable,
  isDatabaseOpen,
  getDatabase,
  getSQLocal,
  closeDatabase,
  execSQL,
  createUuidV7,
  sql,
} from "./client";

// Migrations
export {
  runMigrations,
  initializeDatabase,
  getLastAppliedMigrations,
} from "./migrations";
export { withWriteGate, withWriteTransaction } from "./write-gate";
export { migrationLog } from "./migration-log";
export type { MigrationLogEntry } from "./migration-log";
export { waitForLocalDbReady } from "./ready";

// Query helpers
export {
  withDatabase,
  safeParse,
  firstOrNull,
  firstOrThrow,
  nowISO,
  generateOrderKey,
} from "./helpers";

// Re-export Drizzle ORM utilities for convenience
export {
  eq,
  and,
  or,
  like,
  desc,
  asc,
  gte,
  inArray,
  isNull,
  isNotNull,
} from "drizzle-orm";

// Re-export all schema tables and types
export * from "#shared/db/schema";
