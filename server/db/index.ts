/**
 * Database module barrel export.
 *
 * Import from '#db' for clean access to:
 * - Drizzle schemas (for migrations and type inference)
 * - Repository implementations (for sync simulator)
 * - Database connection utilities
 */

// Drizzle table schemas
export * from "./schema";

// Repository implementations
export * from "./repositories/drizzle";

// Database connection utilities
export {
  getDatabase,
  resetDatabase,
  closeDatabase,
  getSqlite,
} from "./connection";
