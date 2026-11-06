/**
 * Field version schemas.
 *
 * `field_versions` stores the current winning value per entity field for HLC
 * conflict resolution. `field_version_events` is the append-only local history
 * consumed by the Recent Changes feed.
 */
import { sqliteTable, text, index, uniqueIndex } from "drizzle-orm/sqlite-core";

export const fieldVersions = sqliteTable(
  "field_versions",
  {
    id: text("id").primaryKey(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    fieldName: text("field_name").notNull(),
    value: text("value"), // JSON-encoded or null
    hlc: text("hlc").notNull(), // wire format: "wallclock:counter:actorId"
    actorId: text("actor_id").notNull(),
    updatedAt: text("updated_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => ({
    entityFieldUnique: uniqueIndex("field_versions_entity_field_unique").on(
      table.entityType,
      table.entityId,
      table.fieldName
    ),
    entityIdx: index("field_versions_entity_idx").on(
      table.entityType,
      table.entityId
    ),
    updatedAtIdx: index("field_versions_updated_at_idx").on(table.updatedAt),
    actorIdx: index("field_versions_actor_idx").on(table.actorId),
  })
);

export const fieldVersionEvents = sqliteTable(
  "field_version_events",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    fieldName: text("field_name").notNull(),
    value: text("value"), // JSON-encoded or null
    previousValue: text("previous_value"), // value before this event
    hlc: text("hlc").notNull(), // wire format: "wallclock:counter:actorId"
    actorId: text("actor_id").notNull(),
    updatedAt: text("updated_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => ({
    eventFieldUnique: uniqueIndex("field_version_events_event_field_unique").on(
      table.eventId,
      table.fieldName
    ),
    entityIdx: index("field_version_events_entity_idx").on(
      table.entityType,
      table.entityId
    ),
    updatedAtIdx: index("field_version_events_updated_at_idx").on(
      table.updatedAt
    ),
    actorIdx: index("field_version_events_actor_idx").on(table.actorId),
  })
);
