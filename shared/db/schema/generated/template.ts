// GENERATED FILE — do not edit. Run `pnpm gen:schemas` to regenerate.
// Source: services/schema.sql
import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const templates = sqliteTable(
  "templates",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    status: text("status").notNull().default("draft"),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    publishedAt: text("published_at"),
  },
  (table) => ({
    templatesStatusIdx: index("templates_status_idx").on(table.status),
  })
);

export const templateVersions = sqliteTable(
  "template_versions",
  {
    id: text("id").primaryKey(),
    templateId: text("template_id")
      .notNull()
      .references(() => templates.id, { onDelete: "cascade" }),
    versionLabel: text("version_label").notNull(),
    status: text("status").notNull().default("draft"),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    publishedAt: text("published_at"),
  },
  (table) => ({
    templateVersionsTemplateIdx: index("template_versions_template_idx").on(
      table.templateId
    ),
  })
);

export const templatePillars = sqliteTable(
  "template_pillars",
  {
    id: text("id").primaryKey(),
    templateVersionId: text("template_version_id")
      .notNull()
      .references(() => templateVersions.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    orderKey: text("order_key").notNull(),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => ({
    templatePillarsTemplateVersionIdx: index(
      "template_pillars_template_version_idx"
    ).on(table.templateVersionId),
    templatePillarsOrderIdx: index("template_pillars_order_idx").on(
      table.orderKey
    ),
  })
);

export const templateQuestions = sqliteTable(
  "template_questions",
  {
    id: text("id").primaryKey(),
    pillarId: text("pillar_id")
      .notNull()
      .references(() => templatePillars.id, { onDelete: "cascade" }),
    orderKey: text("order_key").notNull(),
    text: text("text").notNull(),
    type: text("type").notNull().default("yes-no"),
    riskLevel: text("risk_level"),
    importance: text("importance"),
    checklistItems: text("checklist_items"),
    leadingPractices: text("leading_practices"),
    helpfulLinks: text("helpful_links"),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => ({
    templateQuestionsPillarIdx: index("template_questions_pillar_idx").on(
      table.pillarId
    ),
    templateQuestionsOrderIdx: index("template_questions_order_idx").on(
      table.orderKey
    ),
  })
);
