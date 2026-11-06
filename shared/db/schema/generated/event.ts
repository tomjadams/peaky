// GENERATED FILE — do not edit. Run `pnpm gen:schemas` to regenerate.
// Source: services/schema.sql
import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { reviews } from "./review";

export const events = sqliteTable(
  "events",
  {
    id: text("id").primaryKey(),
    specversion: text("specversion").notNull().default("1.0"),
    dataschema: text("dataschema"),
    reviewId: text("review_id"),
    eventType: text("event_type").notNull(),
    actorType: text("actor_type").notNull(),
    actorId: text("actor_id").notNull(),
    clientId: text("client_id"),
    data: text("data"),
    time: text("time").notNull(),
    hlc: text("hlc"),
    status: text("status").notNull().default("pending"),
    syncedAt: text("synced_at"),
    source: text("source").notNull().default("peaky.client"),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    rootType: text("root_type"),
    rootId: text("root_id"),
    operation: text("operation").notNull().default("upsert"),
  },
  (table) => ({
    eventsReviewIdx: index("events_review_idx").on(table.reviewId),
    eventsTimeIdx: index("events_time_idx").on(table.time),
    eventsStatusIdx: index("events_status_idx").on(table.status),
    eventsEntityTimeIdx: index("events_entity_time_idx").on(
      table.entityType,
      table.time
    ),
    eventsEntityIdIdx: index("events_entity_id_idx").on(table.entityId),
    eventsRootIdx: index("events_root_idx").on(
      table.rootType,
      table.rootId,
      table.time
    ),
  })
);

export const draftAnswerImports = sqliteTable(
  "draft_answer_imports",
  {
    id: text("id").primaryKey(),
    reviewId: text("review_id")
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
    source: text("source").notNull(),
    runId: text("run_id"),
    importedAt: text("imported_at").notNull(),
    actorId: text("actor_id").notNull(),
  },
  (table) => ({
    draftAnswerImportsReviewIdx: index("draft_answer_imports_review_idx").on(
      table.reviewId
    ),
    draftAnswerImportsSourceIdx: index("draft_answer_imports_source_idx").on(
      table.source
    ),
  })
);

export const draftAnswerEvidence = sqliteTable(
  "draft_answer_evidence",
  {
    id: text("id").primaryKey(),
    importId: text("import_id")
      .notNull()
      .references(() => draftAnswerImports.id, { onDelete: "cascade" }),
    questionId: text("question_id").notNull(),
    answer: text("answer"),
    confidence: text("confidence"),
    evidence: text("evidence"),
  },
  (table) => ({
    draftAnswerEvidenceImportIdx: index("draft_answer_evidence_import_idx").on(
      table.importId
    ),
    draftAnswerEvidenceQuestionIdx: index(
      "draft_answer_evidence_question_idx"
    ).on(table.questionId),
  })
);
