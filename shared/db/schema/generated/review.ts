// GENERATED FILE — do not edit. Run `pnpm gen:schemas` to regenerate.
// Source: services/schema.sql
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { subjects } from "./subject";

export const reviews = sqliteTable(
  "reviews",
  {
    id: text("id").primaryKey(),
    subjectId: text("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    status: text("status").notNull().default("draft"),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => ({
    reviewsSubjectIdx: index("reviews_subject_idx").on(table.subjectId),
    reviewsStatusIdx: index("reviews_status_idx").on(table.status),
  })
);

export const reviewTemplateSelections = sqliteTable(
  "review_template_selections",
  {
    id: text("id").primaryKey(),
    reviewId: text("review_id")
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
    templateVersionId: text("template_version_id").notNull(),
    position: integer("position").notNull().default(0),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => ({
    reviewTemplateSelectionsReviewIdx: index(
      "review_template_selections_review_idx"
    ).on(table.reviewId),
  })
);

export const reviewAnswerState = sqliteTable(
  "review_answer_state",
  {
    id: text("id").primaryKey(),
    reviewId: text("review_id")
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
    questionId: text("question_id").notNull(),
    answer: text("answer"),
    naReason: text("na_reason"),
    itemNaReasons: text("item_na_reasons"),
    updatedAt: text("updated_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => ({
    reviewAnswerStateReviewQuestionUnique: uniqueIndex(
      "review_answer_state_review_question_unique"
    ).on(table.reviewId, table.questionId),
    reviewAnswerStateReviewQuestionIdx: index(
      "review_answer_state_review_question_idx"
    ).on(table.reviewId, table.questionId),
  })
);

export const reviewNoteState = sqliteTable(
  "review_note_state",
  {
    id: text("id").primaryKey(),
    reviewId: text("review_id")
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
    scopeType: text("scope_type").notNull(),
    scopeId: text("scope_id").notNull(),
    content: text("content").notNull(),
    updatedAt: text("updated_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => ({
    reviewNoteStateReviewScopeIdx: index(
      "review_note_state_review_scope_idx"
    ).on(table.reviewId, table.scopeType, table.scopeId),
  })
);

export const reviewAttachments = sqliteTable(
  "review_attachments",
  {
    id: text("id").primaryKey(),
    reviewId: text("review_id")
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
    scopeType: text("scope_type").notNull(),
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
    reviewAttachmentsReviewIdx: index("review_attachments_review_idx").on(
      table.reviewId
    ),
  })
);

export const reviewScoreState = sqliteTable(
  "review_score_state",
  {
    id: text("id").primaryKey(),
    reviewId: text("review_id")
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
    scoreType: text("score_type").notNull(),
    numericScore: integer("numeric_score"),
    band: text("band"),
    scoreBreakdown: text("score_breakdown"),
    computedAt: text("computed_at").notNull(),
  },
  (table) => ({
    reviewScoreStateReviewIdx: index("review_score_state_review_idx").on(
      table.reviewId
    ),
  })
);

export const reviewParticipants = sqliteTable(
  "review_participants",
  {
    id: text("id").primaryKey(),
    reviewId: text("review_id")
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
    actorId: text("actor_id").notNull(),
    role: text("role").notNull(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    avatarUrl: text("avatar_url"),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => ({
    reviewParticipantsReviewIdx: index("review_participants_review_idx").on(
      table.reviewId
    ),
    reviewParticipantsActorIdx: index("review_participants_actor_idx").on(
      table.actorId
    ),
  })
);
