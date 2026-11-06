/**
 * Template schema - stable Template identities with draft and immutable Revisions.
 *
 * Templates hold current catalog metadata; Revisions hold complete authored snapshots.
 *
 * Shared between server (better-sqlite3) and client (SQLocal + Drizzle).
 */
import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const templateStatus = ["active", "archived"] as const;
export type TemplateStatus = (typeof templateStatus)[number];
export const templateRevisionStatus = [
  "draft",
  "published",
  "retired",
] as const;
export type TemplateRevisionStatus = (typeof templateRevisionStatus)[number];

export const templates = sqliteTable(
  "templates",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    status: text("status", { enum: templateStatus })
      .notNull()
      .default("active"),
    ownerTeamId: text("owner_team_id").notNull(),
    createdByActorId: text("created_by_actor_id").notNull(),
    updatedByActorId: text("updated_by_actor_id").notNull(),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => ({
    statusCheck: check(
      "templates_status_check",
      sql`${table.status} IN ('active', 'archived')`
    ),
    statusIdx: index("templates_status_idx").on(table.status),
  })
);

export const templateRevisions = sqliteTable(
  "template_revisions",
  {
    id: text("id").primaryKey(),
    templateId: text("template_id")
      .notNull()
      .references(() => templates.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull(),
    status: text("status", { enum: templateRevisionStatus })
      .notNull()
      .default("draft"),
    revisionNumber: integer("revision_number"),
    revisionSummary: text("revision_summary"),
    createdByActorId: text("created_by_actor_id").notNull(),
    updatedByActorId: text("updated_by_actor_id").notNull(),
    publishedByActorId: text("published_by_actor_id"),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    publishedAt: text("published_at"),
    // Schema-versioned MaturityDefinition JSON document (one per Revision);
    // NULL is the explicit no-definition state (maturity-score/AC-060).
    maturityDefinition: text("maturity_definition"),
  },
  (table) => ({
    statusCheck: check(
      "template_revisions_status_check",
      sql`${table.status} IN ('draft', 'published', 'retired')`
    ),
    publicationCheck: check(
      "template_revisions_publication_check",
      sql`(
        (${table.status} = 'draft' AND ${table.revisionNumber} IS NULL AND ${table.publishedAt} IS NULL AND ${table.publishedByActorId} IS NULL)
        OR
        (${table.status} IN ('published', 'retired') AND ${table.revisionNumber} IS NOT NULL AND typeof(${table.revisionNumber}) = 'integer' AND ${table.revisionNumber} > 0 AND ${table.publishedAt} IS NOT NULL AND ${table.publishedByActorId} IS NOT NULL)
      )`
    ),
    summaryCheck: check(
      "template_revisions_summary_check",
      sql`${table.revisionSummary} IS NULL OR (length(trim(${table.revisionSummary})) >= 1 AND length(trim(${table.revisionSummary})) <= 120)`
    ),
    templateIdx: index("template_revisions_template_idx").on(table.templateId),
    oneDraftIdx: uniqueIndex("template_revisions_one_draft_idx")
      .on(table.templateId)
      .where(sql`${table.status} = 'draft'`),
    onePublishedIdx: uniqueIndex("template_revisions_one_published_idx")
      .on(table.templateId)
      .where(sql`${table.status} = 'published'`),
    numberUniqueIdx: uniqueIndex("template_revisions_number_unique_idx")
      .on(table.templateId, table.revisionNumber)
      .where(sql`${table.revisionNumber} IS NOT NULL`),
  })
);

export const templatePillars = sqliteTable(
  "template_pillars",
  {
    id: text("id").primaryKey(),
    templateRevisionId: text("template_revision_id")
      .notNull()
      .references(() => templateRevisions.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    orderKey: text("order_key").notNull(), // Durable ordering: "0001", "0002", etc.
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => ({
    revisionSlugUniqueIdx: uniqueIndex(
      "template_pillars_revision_slug_unique_idx"
    ).on(table.templateRevisionId, table.slug),
    templateRevisionIdx: index("template_pillars_template_revision_idx").on(
      table.templateRevisionId
    ),
    orderIdx: index("template_pillars_order_idx").on(
      table.templateRevisionId,
      table.orderKey
    ),
  })
);

export const riskLevel = ["critical", "high", "medium"] as const;
export type RiskLevel = (typeof riskLevel)[number];
export const questionType = ["yes-no", "checklist"] as const;
export type QuestionType = (typeof questionType)[number];

export const templateQuestions = sqliteTable(
  "template_questions",
  {
    id: text("id").primaryKey(),
    pillarId: text("pillar_id")
      .notNull()
      .references(() => templatePillars.id, { onDelete: "cascade" }),
    orderKey: text("order_key").notNull(),
    text: text("text").notNull(),
    type: text("type", { enum: questionType }).notNull().default("yes-no"),
    riskLevel: text("risk_level", { enum: riskLevel }),
    importance: text("importance"),
    checklistItems: text("checklist_items"), // JSON array
    leadingPractices: text("leading_practices"), // JSON array
    helpfulLinks: text("helpful_links"), // JSON array
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => ({
    typeCheck: check(
      "template_questions_type_check",
      sql`${table.type} IN ('yes-no', 'checklist')`
    ),
    riskLevelCheck: check(
      "template_questions_risk_level_check",
      sql`${table.riskLevel} IS NULL OR ${table.riskLevel} IN ('critical', 'high', 'medium')`
    ),
    pillarIdx: index("template_questions_pillar_idx").on(table.pillarId),
    orderIdx: index("template_questions_order_idx").on(
      table.pillarId,
      table.orderKey
    ),
  })
);
