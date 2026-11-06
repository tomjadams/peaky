/**
 * Database query helpers for local-first composables.
 *
 * Reduces boilerplate and provides defensive patterns.
 */

import { getDatabase } from "./client";
import { ensureLocalDatabaseReady } from "./bootstrap";

/**
 * Execute a query with the database instance.
 * Eliminates repetitive `const db = await getDatabase()` calls.
 */
export async function withDatabase<T>(
  fn: (db: Awaited<ReturnType<typeof getDatabase>>) => Promise<T>
): Promise<T> {
  await ensureLocalDatabaseReady();
  const db = await getDatabase();
  return fn(db);
}

/**
 * Safely parse JSON with fallback.
 * Defensive against malformed JSON strings.
 */
export function safeParse<T>(json: string | null | undefined, fallback: T): T {
  if (json == null) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/**
 * Get first result or null.
 * Safe alternative to `results[0]!`.
 */
export function firstOrNull<T>(results: T[] | undefined | null): T | null {
  return results?.[0] ?? null;
}

/**
 * Get first result or throw descriptive error.
 * Replaces non-null assertions with explicit error handling.
 */
export function firstOrThrow<T>(
  results: T[] | undefined | null,
  message: string
): T {
  const item = results?.[0];
  if (!item) throw new Error(message);
  return item;
}

/**
 * Current timestamp in ISO format.
 * Eliminates repetitive `new Date().toISOString()` calls.
 */
export function nowISO(): string {
  return new Date().toISOString();
}

/**
 * Generate order key for reordering operations.
 * Shared between pillars and questions.
 */
export function generateOrderKey(index: number): string {
  return String(index).padStart(4, "0");
}
