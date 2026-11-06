/**
 * Local SQLite database client using SQLocal + Drizzle ORM.
 *
 * Provides durable browser-local storage for first-party editing domains.
 * Uses SQLocal which wraps SQLite WASM with OPFS for persistent storage.
 *
 * @see site/docs/development/walkthroughs/local-first-architecture.md
 */

import { SQLocalDrizzle } from "sqlocal/drizzle";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { sql } from "drizzle-orm";
import * as schema from "#shared/db/schema";
import { createUuidV7 } from "#shared/id";

/** Database name for the local-first store */
export const DB_NAME = "peaky-local";

/** SQLocal + Drizzle instance */
let client: SQLocalDrizzle | null = null;

/** Drizzle ORM instance for type-safe queries */
let db: ReturnType<typeof drizzle> | null = null;

/**
 * Check if OPFS is available in this browser.
 */
export function isOpfsAvailable(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "storage" in navigator &&
    "getDirectory" in navigator.storage
  );
}

/**
 * Initialize the database client.
 * Creates SQLocalDrizzle instance and Drizzle ORM wrapper.
 */
async function initClient(): Promise<void> {
  if (client && db) return;

  if (!isOpfsAvailable()) {
    console.warn("[local-db] OPFS not available, using in-memory storage");
  }

  // Create SQLocalDrizzle instance
  // This automatically handles OPFS persistence and WASM loading.
  // Enable SQLite foreign-key enforcement per connection — SQLite leaves
  // FK disabled by default, so ON DELETE CASCADE in the schema would be
  // silently ignored without this PRAGMA.
  client = new SQLocalDrizzle({
    databasePath: `${DB_NAME}.sqlite3`,
    onInit: (sqlTag) => [sqlTag`PRAGMA foreign_keys = ON`],
  });

  // Extract drivers for Drizzle
  const { driver, batchDriver } = client;

  // Create Drizzle ORM instance with shared schema
  db = drizzle(driver, batchDriver, { schema });

  console.log(
    "[local-db] Database initialized successfully:",
    isOpfsAvailable() ? "OPFS (persistent)" : "memory (ephemeral)"
  );
}

/**
 * Get the Drizzle ORM instance for type-safe queries.
 * Initializes the client on first access.
 */
export async function getDatabase(): Promise<ReturnType<typeof drizzle>> {
  if (!db) {
    await initClient();
  }
  if (!db) {
    throw new Error("Database initialization failed");
  }
  return db;
}

/**
 * Get the raw SQLocal client for transactions and direct SQL.
 * Use this for transactions (recommended over Drizzle's transaction method).
 */
export async function getSQLocal(): Promise<SQLocalDrizzle> {
  if (!client) {
    await initClient();
  }
  if (!client) {
    throw new Error("SQLocal client initialization failed");
  }
  return client;
}

/**
 * Check if database is currently initialized.
 */
export function isDatabaseOpen(): boolean {
  return client !== null && db !== null;
}

/**
 * Close and reset the database connection.
 * Useful for testing or clearing all data.
 */
export async function closeDatabase(): Promise<void> {
  if (client) {
    // SQLocal doesn't have a close method, but we can reset our references
    client = null;
    db = null;
  }
}

/**
 * Execute raw SQL (for debugging or advanced use cases).
 * Prefer using Drizzle's query builder for type safety.
 */
export async function execSQL(query: string): Promise<void> {
  const sqlocal = await getSQLocal();
  await sqlocal.exec(query, []);
}

export { createUuidV7 };

// Re-export sql for raw SQL in queries
export { sql };

// Re-export schema types for convenience
export type { schema };
