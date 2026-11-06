/**
 * Subject schema - teams, products, and organizations.
 *
 * Subjects are the entities that can be reviewed.
 * Each subject has a type and optional type-specific profiles.
 *
 * Shared between server (better-sqlite3) and client (SQLocal + Drizzle).
 */
import { sqliteTable, text, index, uniqueIndex } from "drizzle-orm/sqlite-core";

export const subjectStatus = ["active", "inactive", "archived"] as const;
export const subjectType = ["team", "product", "organization"] as const;

export const subjects = sqliteTable(
  "subjects",
  {
    id: text("id").primaryKey(),
    type: text("type", { enum: subjectType }).notNull(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    status: text("status", { enum: subjectStatus }).notNull().default("active"),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => ({
    typeIdx: index("subjects_type_idx").on(table.type),
    statusIdx: index("subjects_status_idx").on(table.status),
  })
);

export const subjectComponentLinks = sqliteTable(
  "subject_component_links",
  {
    id: text("id").primaryKey(),
    subjectId: text("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    componentId: text("component_id").notNull(),
    relationshipType: text("relationship_type").notNull().default("contains"),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => ({
    subjectComponentIdx: index(
      "subject_component_links_subject_component_idx"
    ).on(table.subjectId, table.componentId),
    subjectComponentUniqueIdx: uniqueIndex(
      "subject_component_links_subject_component_unique_idx"
    ).on(table.subjectId, table.componentId),
  })
);
