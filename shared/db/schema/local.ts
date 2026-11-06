/**
 * Local-first specific schema - client-only tables for offline editing.
 *
 * These tables are specific to the local-first client:
 * - Product and Team profiles
 * - Template Revision import provenance
 * - Review handoff lifecycle sequences
 *
 * These are NOT in the server schema as they represent client-only state.
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
import { reviews } from "./review";
import { subjects } from "./subject";
import { templateRevisions } from "./template";

// Product profiles (extends subjects with type='product')
export const productOrigin = ["bespoke", "open-source", "vendor"] as const;
export type ProductOrigin = (typeof productOrigin)[number];

export const productProfiles = sqliteTable(
  "product_profiles",
  {
    id: text("id").primaryKey(),
    subjectId: text("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    origin: text("origin", { enum: productOrigin }).notNull(),
    isExternal: integer("is_external").notNull().default(0),
    productManagerId: text("product_manager_id").notNull(),
    engineeringLeadId: text("engineering_lead_id"),
    teamIds: text("team_ids").notNull().default("[]"), // JSON array
    componentIds: text("component_ids").notNull().default("[]"), // JSON array
    roadmapUrl: text("roadmap_url"),
    documentationUrl: text("documentation_url"),
    supportChannel: text("support_channel"),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => ({
    subjectIdx: index("product_profiles_subject_idx").on(table.subjectId),
  })
);

// Team profiles (extends subjects with type='team')
export const teamProfiles = sqliteTable(
  "team_profiles",
  {
    id: text("id").primaryKey(),
    subjectId: text("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    orgId: text("org_id").notNull(),
    orgName: text("org_name").notNull(),
    memberCount: integer("member_count").notNull().default(0),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => ({
    subjectIdx: index("team_profiles_subject_idx").on(table.subjectId),
    orgIdx: index("team_profiles_org_idx").on(table.orgId),
  })
);

export const templateRevisionImportSource = ["markdown", "json"] as const;
export type TemplateRevisionImportSource =
  (typeof templateRevisionImportSource)[number];

export const templateRevisionImports = sqliteTable(
  "template_revision_imports",
  {
    id: text("id").primaryKey(),
    templateRevisionId: text("template_revision_id")
      .notNull()
      .references(() => templateRevisions.id, { onDelete: "cascade" }),
    sourceType: text("source_type", {
      enum: templateRevisionImportSource,
    }).notNull(),
    sourceFile: text("source_file"),
    importedAt: text("imported_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    conflicts: text("conflicts").notNull().default("[]"), // JSON array
    resolved: text("resolved").notNull().default("[]"), // JSON array
  },
  (table) => ({
    revisionIdx: index("template_revision_imports_revision_idx").on(
      table.templateRevisionId
    ),
  })
);

export const localReviewHandoffStatus = ["active", "completed"] as const;
export type LocalReviewHandoffStatus =
  (typeof localReviewHandoffStatus)[number];

export const localReviewHandoffCompletionMode = ["auto", "manual"] as const;
export type LocalReviewHandoffCompletionMode =
  (typeof localReviewHandoffCompletionMode)[number];

/**
 * Device-local handoff lifecycle. Practice content remains in the synchronized
 * review_handoff_practices table; this table only groups those rows into local
 * sequences and freezes completion analytics.
 */
export const localReviewHandoffs = sqliteTable(
  "local_review_handoffs",
  {
    // Deterministic: review_handoff:<reviewId>/<sequence>
    id: text("id").primaryKey(),
    reviewId: text("review_id")
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
    sequence: integer("sequence").notNull(),
    status: text("status", { enum: localReviewHandoffStatus }).notNull(),
    createdAt: text("created_at").notNull(),
    createdBy: text("created_by").notNull(),
    completedAt: text("completed_at"),
    completionMode: text("completion_mode", {
      enum: localReviewHandoffCompletionMode,
    }),
    completedBy: text("completed_by"),
    note: text("note"),
    selectedPracticeIds: text("selected_practice_ids").notNull().default("[]"), // JSON array, frozen on completion
    unresolvedCount: integer("unresolved_count"),
  },
  (table) => ({
    idShapeCheck: check(
      "local_review_handoffs_id_shape_check",
      sql`${table.id} = 'review_handoff:' || ${table.reviewId} || '/' || ${table.sequence}`
    ),
    sequenceCheck: check(
      "local_review_handoffs_sequence_check",
      sql`typeof(${table.sequence}) = 'integer' AND ${table.sequence} >= 1`
    ),
    statusCheck: check(
      "local_review_handoffs_status_check",
      sql`${table.status} IN ('active', 'completed')`
    ),
    selectedPracticeIdsCheck: check(
      "local_review_handoffs_selected_practice_ids_check",
      sql`json_valid(${table.selectedPracticeIds}) AND json_type(${table.selectedPracticeIds}) = 'array'`
    ),
    completionCheck: check(
      "local_review_handoffs_completion_check",
      sql`(
        (${table.status} = 'active'
          AND ${table.completedAt} IS NULL
          AND ${table.completionMode} IS NULL
          AND ${table.completedBy} IS NULL
          AND ${table.note} IS NULL
          AND ${table.unresolvedCount} IS NULL)
        OR
        (${table.status} = 'completed'
          AND ${table.completedAt} IS NOT NULL
          AND datetime(${table.completedAt}) IS NOT NULL
          AND ${table.completedAt} >= ${table.createdAt}
          AND ${table.completionMode} IN ('auto', 'manual')
          AND ${table.completedBy} IS NOT NULL
          AND length(${table.completedBy}) > 0
          AND typeof(${table.unresolvedCount}) = 'integer'
          AND ${table.unresolvedCount} >= 0
          AND ${table.unresolvedCount} <= json_array_length(${table.selectedPracticeIds})
          AND (${table.note} IS NULL
            OR (${table.completionMode} = 'manual'
              AND length(trim(${table.note})) BETWEEN 1 AND 2000))
          AND (${table.completionMode} = 'manual'
            OR (${table.unresolvedCount} = 0
              AND json_array_length(${table.selectedPracticeIds}) > 0
              AND ${table.note} IS NULL))
          AND (${table.unresolvedCount} = 0 OR ${table.note} IS NOT NULL))
      )`
    ),
    actorShapeCheck: check(
      "local_review_handoffs_actor_shape_check",
      sql`length(${table.createdBy}) > 0 AND datetime(${table.createdAt}) IS NOT NULL`
    ),
    reviewSequenceUniqueIdx: uniqueIndex(
      "local_review_handoffs_review_sequence_unique"
    ).on(table.reviewId, table.sequence),
    activeReviewUniqueIdx: uniqueIndex(
      "local_review_handoffs_active_review_unique"
    )
      .on(table.reviewId)
      .where(sql`${table.status} = 'active'`),
    reviewIdx: index("local_review_handoffs_review_idx").on(table.reviewId),
  })
);
