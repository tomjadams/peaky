// GENERATED FILE — do not edit. Run `pnpm gen:schemas` to regenerate.
// Source: services/schema.sql
import { index, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const subjects = sqliteTable(
  "subjects",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    status: text("status").notNull().default("active"),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => ({
    subjectsSlugUnique: uniqueIndex("subjects_slug_unique").on(table.slug),
    subjectsTypeIdx: index("subjects_type_idx").on(table.type),
    subjectsStatusIdx: index("subjects_status_idx").on(table.status),
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
    subjectComponentLinksUnique: uniqueIndex(
      "subject_component_links_unique"
    ).on(table.subjectId, table.componentId),
    subjectComponentLinksSubjectIdx: index(
      "subject_component_links_subject_idx"
    ).on(table.subjectId),
  })
);
