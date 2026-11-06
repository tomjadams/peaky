/**
 * Schema barrel export.
 *
 * Import from '#shared/db/schema' for clean access to all table definitions.
 * Single source of truth for both server (Drizzle ORM) and client (SQLite WASM).
 */

// Core domain tables
export * from "./subject";
export * from "./review";
export * from "./template";
export * from "./event";

// Sync infrastructure
export * from "./sync";

// Field versions — HLC change tracking (populated from server pull)
export * from "./field-version";

// Catalog + directory mirror tables
export * from "./catalog-directory";

// Local-only tables
export * from "./local";
