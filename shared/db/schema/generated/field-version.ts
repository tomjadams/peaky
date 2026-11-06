// GENERATED FILE — do not edit. Run `pnpm gen:schemas` to regenerate.
// Source: services/schema.sql
import { index, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { events } from "./event";

export const fieldVersions = sqliteTable(
  "field_versions",
  {
    id: text("id").primaryKey(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    fieldName: text("field_name").notNull(),
    value: text("value"),
    hlc: text("hlc").notNull(),
    actorId: text("actor_id").notNull(),
    updatedAt: text("updated_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => ({
    fieldVersionsEntityFieldUnique: uniqueIndex(
      "field_versions_entity_field_unique"
    ).on(table.entityType, table.entityId, table.fieldName),
    fieldVersionsEntityIdx: index("field_versions_entity_idx").on(
      table.entityType,
      table.entityId
    ),
    fieldVersionsUpdatedAtIdx: index("field_versions_updated_at_idx").on(
      table.updatedAt
    ),
    fieldVersionsActorIdx: index("field_versions_actor_idx").on(table.actorId),
  })
);

export const fieldVersionEvents = sqliteTable(
  "field_version_events",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    fieldName: text("field_name").notNull(),
    value: text("value"),
    previousValue: text("previous_value"),
    hlc: text("hlc").notNull(),
    actorId: text("actor_id").notNull(),
    updatedAt: text("updated_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => ({
    fieldVersionEventsEventFieldUnique: uniqueIndex(
      "field_version_events_event_field_unique"
    ).on(table.eventId, table.fieldName),
    fieldVersionEventsEntityIdx: index("field_version_events_entity_idx").on(
      table.entityType,
      table.entityId
    ),
    fieldVersionEventsUpdatedAtIdx: index(
      "field_version_events_updated_at_idx"
    ).on(table.updatedAt),
    fieldVersionEventsActorIdx: index("field_version_events_actor_idx").on(
      table.actorId
    ),
  })
);
