/**
 * Review schema - assessments with answers, notes, attachments, scores, and participants.
 *
 * Shared between server (better-sqlite3) and client (SQLocal + Drizzle).
 */
import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
  type AnySQLiteColumn,
} from "drizzle-orm/sqlite-core";
import { subjects } from "./subject";
import { templateRevisions } from "./template";

export const reviewStatus = [
  "draft",
  "in-progress",
  "completed",
  "archived",
] as const;
export type ReviewStatus = (typeof reviewStatus)[number];

// Note scope
export const noteScope = ["review", "pillar", "question"] as const;
export type NoteScope = (typeof noteScope)[number];

export const reviews = sqliteTable(
  "reviews",
  {
    id: text("id").primaryKey(),
    subjectId: text("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    status: text("status", { enum: reviewStatus }).notNull().default("draft"),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => ({
    subjectIdx: index("reviews_subject_idx").on(table.subjectId),
    statusIdx: index("reviews_status_idx").on(table.status),
  })
);

export const reviewTemplateSelections = sqliteTable(
  "review_template_selections",
  {
    reviewId: text("review_id")
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
    templateRevisionId: text("template_revision_id")
      .notNull()
      .references(() => templateRevisions.id, { onDelete: "restrict" }),
    position: integer("position").notNull(),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => ({
    primaryKey: primaryKey({
      columns: [table.reviewId, table.templateRevisionId],
    }),
    reviewPositionUniqueIdx: uniqueIndex(
      "review_template_selections_review_position_unique"
    ).on(table.reviewId, table.position),
    positionCheck: check(
      "review_template_selections_position_check",
      sql`typeof(${table.position}) = 'integer' AND ${table.position} BETWEEN 0 AND 2`
    ),
  })
);

// Answer state - current answers for fast reads
export const reviewAnswerState = sqliteTable(
  "review_answer_state",
  {
    id: text("id").primaryKey(),
    reviewId: text("review_id")
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
    questionId: text("question_id").notNull(),
    answer: text("answer"), // JSON: QuestionAnswer
    naReason: text("na_reason"), // JSON: NotApplicableReason
    itemNaReasons: text("item_na_reasons"), // JSON: Record<string, NotApplicableReason>
    updatedAt: text("updated_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => ({
    reviewQuestionIdx: index("review_answer_state_review_question_idx").on(
      table.reviewId,
      table.questionId
    ),
    reviewQuestionUniqueIdx: uniqueIndex(
      "review_answer_state_review_question_unique_idx"
    ).on(table.reviewId, table.questionId),
  })
);

// Note state - notes at review, pillar, or question scope
// Note: noteScope type is defined above with the const declaration

export const reviewNoteState = sqliteTable(
  "review_note_state",
  {
    id: text("id").primaryKey(),
    reviewId: text("review_id")
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
    scopeType: text("scope_type", { enum: noteScope }).notNull(),
    scopeId: text("scope_id").notNull(),
    content: text("content").notNull(),
    updatedAt: text("updated_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => ({
    reviewScopeIdx: index("review_note_state_review_scope_idx").on(
      table.reviewId,
      table.scopeType,
      table.scopeId
    ),
  })
);

// Attachments
export const reviewAttachments = sqliteTable(
  "review_attachments",
  {
    id: text("id").primaryKey(),
    reviewId: text("review_id")
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
    scopeType: text("scope_type", { enum: noteScope }).notNull(),
    scopeId: text("scope_id").notNull(),
    filename: text("filename").notNull(),
    objectKey: text("object_key").notNull(),
    mimeType: text("mime_type"),
    size: integer("size"),
    createdBy: text("created_by").notNull().default(""),
    createdByName: text("created_by_name").notNull().default(""),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => ({
    reviewIdx: index("review_attachments_review_idx").on(table.reviewId),
  })
);

// Scores
export const scoreType = ["readiness", "maturity"] as const;

export const reviewScoreState = sqliteTable(
  "review_score_state",
  {
    id: text("id").primaryKey(),
    reviewId: text("review_id")
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
    scoreType: text("score_type", { enum: scoreType }).notNull(),
    numericScore: integer("numeric_score"),
    band: text("band"),
    scoreBreakdown: text("score_breakdown"), // JSON: Record<string, number>
    computedAt: text("computed_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => ({
    reviewIdx: index("review_score_state_review_idx").on(table.reviewId),
  })
);

// Maturity overrides — append-only Advisor transition stream keyed by Review
// and templateRevisionId (maturity-score/REQ-016). Rows are never updated or
// deleted; the current effective override is resolved on read as the latest
// non-revoked transition, never stored as a mutable pointer (AC-031).
export const maturityOverrideAction = [
  "create",
  "supersede",
  "revoke",
] as const;
export type MaturityOverrideAction = (typeof maturityOverrideAction)[number];

export const reviewMaturityOverrides = sqliteTable(
  "review_maturity_overrides",
  {
    id: text("id").primaryKey(),
    reviewId: text("review_id")
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
    // Opaque TemplateRevision identity — compared exactly, never parsed.
    templateRevisionId: text("template_revision_id").notNull(),
    action: text("action", { enum: maturityOverrideAction }).notNull(),
    // Reviewed value on create/supersede; NULL on revoke.
    reviewedPercent: integer("reviewed_percent"),
    reviewedStage: integer("reviewed_stage"),
    explanation: text("explanation"),
    evidence: text("evidence"), // JSON array of evidence identifiers
    priorTransitionId: text("prior_transition_id").references(
      (): AnySQLiteColumn => reviewMaturityOverrides.id
    ),
    actorId: text("actor_id").notNull(),
    occurredAt: text("occurred_at").notNull(),
  },
  (table) => ({
    actionCheck: check(
      "review_maturity_overrides_action_check",
      sql`${table.action} IN ('create', 'supersede', 'revoke')`
    ),
    valueCheck: check(
      "review_maturity_overrides_value_check",
      sql`(
        (${table.action} = 'revoke' AND ${table.reviewedPercent} IS NULL AND ${table.reviewedStage} IS NULL)
        OR
        (${table.action} IN ('create', 'supersede')
          AND ${table.reviewedPercent} IS NOT NULL AND ${table.reviewedPercent} BETWEEN 0 AND 100
          AND ${table.reviewedStage} IS NOT NULL AND ${table.reviewedStage} BETWEEN 1 AND 5)
      )`
    ),
    reviewRevisionIdx: index(
      "review_maturity_overrides_review_revision_idx"
    ).on(table.reviewId, table.templateRevisionId),
    priorIdx: index("review_maturity_overrides_prior_idx").on(
      table.priorTransitionId
    ),
  })
);

// Handoff practices — one row per selected practice (design Decision 3 of
// implement-maturity-score; improvement-plans/REQ-005, REQ-006). Entity IDs
// are deterministic from the (review, revision, question, practice) tuple so
// concurrent clients converge on one synchronized row. Order key, rationale,
// and selection state move by ordinary field-level HLC writes.
export const handoffSelectionState = ["selected", "removed"] as const;
export type HandoffSelectionState = (typeof handoffSelectionState)[number];

export const reviewHandoffPractices = sqliteTable(
  "review_handoff_practices",
  {
    // Deterministic: review_handoff_practice:<review>/<revision>/<question>/<practice>
    id: text("id").primaryKey(),
    reviewId: text("review_id")
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
    // Opaque TemplateRevision identity — compared exactly, never parsed.
    templateRevisionId: text("template_revision_id").notNull(),
    questionId: text("question_id").notNull(),
    // Checklist-item ID; equals questionId for Yes/No questions (AC-016).
    practiceId: text("practice_id").notNull(),
    orderKey: text("order_key").notNull(),
    snapshot: text("snapshot").notNull(), // JSON: PracticeSnapshot
    rationale: text("rationale"),
    selectionState: text("selection_state", {
      enum: handoffSelectionState,
    }).notNull(),
    // Device-local lifecycle ownership. Never sent through handoff sync.
    localHandoffId: text("local_handoff_id"),
    actorId: text("actor_id").notNull(),
    occurredAt: text("occurred_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    selectionStateCheck: check(
      "review_handoff_practices_selection_state_check",
      sql`${table.selectionState} IN ('selected', 'removed')`
    ),
    identityUniqueIdx: uniqueIndex(
      "review_handoff_practices_identity_unique"
    ).on(
      table.reviewId,
      table.templateRevisionId,
      table.questionId,
      table.practiceId
    ),
    reviewIdx: index("review_handoff_practices_review_idx").on(table.reviewId),
    localHandoffIdx: index("review_handoff_practices_local_handoff_idx").on(
      table.localHandoffId
    ),
  })
);

// Handoff associations — append-only transition stream per practice
// (improvement-plans/REQ-007, REQ-008). Rows are never updated or deleted;
// the current association is resolved on read as the latest non-revoked
// transition (AC-032), never stored as a mutable pointer.
export const handoffAssociationAction = [
  "associate",
  "replace",
  "revoke",
] as const;
export type HandoffAssociationAction =
  (typeof handoffAssociationAction)[number];

export const reviewHandoffAssociations = sqliteTable(
  "review_handoff_associations",
  {
    id: text("id").primaryKey(),
    reviewId: text("review_id")
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
    // Deterministic practice row ID; no FK so sync can apply the transition
    // before the practice row arrives.
    practiceEntityId: text("practice_entity_id").notNull(),
    action: text("action", { enum: handoffAssociationAction }).notNull(),
    // External work-item reference; NULL on revoke.
    provider: text("provider"),
    externalId: text("external_id"),
    url: text("url"),
    priorTransitionId: text("prior_transition_id").references(
      (): AnySQLiteColumn => reviewHandoffAssociations.id
    ),
    actorId: text("actor_id").notNull(),
    occurredAt: text("occurred_at").notNull(),
  },
  (table) => ({
    actionCheck: check(
      "review_handoff_associations_action_check",
      sql`${table.action} IN ('associate', 'replace', 'revoke')`
    ),
    referenceCheck: check(
      "review_handoff_associations_reference_check",
      sql`(
        (${table.action} = 'revoke' AND ${table.provider} IS NULL AND ${table.externalId} IS NULL AND ${table.url} IS NULL)
        OR
        (${table.action} IN ('associate', 'replace')
          AND ${table.provider} IS NOT NULL
          AND ${table.externalId} IS NOT NULL
          AND ${table.url} IS NOT NULL)
      )`
    ),
    practiceIdx: index("review_handoff_associations_practice_idx").on(
      table.practiceEntityId
    ),
    reviewIdx: index("review_handoff_associations_review_idx").on(
      table.reviewId
    ),
    priorIdx: index("review_handoff_associations_prior_idx").on(
      table.priorTransitionId
    ),
  })
);

// Participants
export const participantRole = ["assessor", "reviewer"] as const;

export const reviewParticipants = sqliteTable(
  "review_participants",
  {
    id: text("id").primaryKey(),
    reviewId: text("review_id")
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
    actorId: text("actor_id").notNull(),
    role: text("role", { enum: participantRole }).notNull(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    avatarUrl: text("avatar_url"),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => ({
    reviewIdx: index("review_participants_review_idx").on(table.reviewId),
    actorIdx: index("review_participants_actor_idx").on(table.actorId),
  })
);
