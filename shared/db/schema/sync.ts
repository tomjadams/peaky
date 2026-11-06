/**
 * Sync schema - outbox, entitlements, cursors, and pending review queue.
 *
 * These tables support offline editing, sync, and reconnect handling.
 *
 * Shared between server (better-sqlite3) and client (SQLocal + Drizzle).
 *
 * Formal model: formal_verification/sync/outbox_item_lifecycle.fizz — adding an
 * outboxStatus value means adding the transition to that spec first, otherwise it
 * proves a lifecycle the code no longer has.
 */
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const outboxStatus = ["pending", "syncing", "synced", "failed"] as const;

// Local outbox - queued changes for sync
export const localOutbox = sqliteTable(
  "local_outbox",
  {
    id: text("id").primaryKey(),
    actorId: text("actor_id"),
    entityType: text("entity_type").notNull(), // "review", "product", "template_draft"
    entityId: text("entity_id").notNull(),
    operation: text("operation").notNull(), // "upsert" | "delete" (legacy: "create", "update")
    fields: text("fields").notNull().default("[]"), // JSON: FieldValue[] — structured field-level HLC data
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    status: text("status", { enum: outboxStatus }).notNull().default("pending"),
    retryCount: integer("retry_count").notNull().default(0),
    updatedAt: text("updated_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    lastError: text("last_error"),
    syncedAt: text("synced_at"),
  },
  (table) => ({
    actorStatusIdx: index("local_outbox_actor_status_idx").on(
      table.actorId,
      table.status
    ),
    entityIdx: index("local_outbox_entity_idx").on(
      table.entityType,
      table.entityId
    ),
  })
);

// Entitlement snapshots - cached permissions for offline editing
export const entitlementSnapshots = sqliteTable(
  "entitlement_snapshots",
  {
    id: text("id").primaryKey(),
    actorId: text("actor_id").notNull().unique(),
    entitlements: text("entitlements").notNull(), // JSON: Record<string, { canEdit, canView }>
    snapshotVersion: integer("snapshot_version").notNull().default(1),
    validUntil: text("valid_until"), // For offline editing window
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    refreshAt: text("refresh_at"),
  },
  (table) => ({
    actorIdx: index("entitlement_snapshots_actor_idx").on(table.actorId),
  })
);

// Sync cursors - track sync positions
export const syncCursors = sqliteTable(
  "sync_cursors",
  {
    id: text("id").primaryKey(),
    actorId: text("actor_id").notNull().unique(),
    localCursor: text("local_cursor"), // ISO timestamp of last local event
    remoteCursor: text("remote_cursor"), // ISO timestamp of last remote event
    updatedAt: text("updated_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => ({
    actorIdx: index("sync_cursors_actor_idx").on(table.actorId),
  })
);

// Pending review queue - conflicts and revoked access items
export const pendingReviewReason = [
  "access_revoked",
  "conflict",
  "rejected",
] as const;
export const pendingReviewResolution = [
  "keep_local",
  "keep_remote",
  "merged",
] as const;

export const pendingReviewQueue = sqliteTable(
  "pending_review_queue",
  {
    id: text("id").primaryKey(),
    actorId: text("actor_id").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    reason: text("reason", { enum: pendingReviewReason }).notNull(),
    localPayload: text("local_payload"), // JSON: local version (note: differs from server schema)
    remotePayload: text("remote_payload"), // JSON: remote version (if conflict)
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    resolution: text("resolution", { enum: pendingReviewResolution }),
    resolvedAt: text("resolved_at"),
  },
  (table) => ({
    actorIdx: index("pending_review_queue_actor_idx").on(table.actorId),
    entityIdx: index("pending_review_queue_entity_idx").on(
      table.entityType,
      table.entityId
    ),
  })
);
