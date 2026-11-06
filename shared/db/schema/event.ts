/**
 * Event schema - append-only audit log and provenance tracking.
 *
 * Domain events are the source of truth for history derivation.
 * Draft answer imports track machine-generated answer provenance.
 *
 * Shared between server (better-sqlite3) and client (SQLocal + Drizzle).
 */

// This table is the permanent audit trail for all domain and system operations.
// It is intentionally decoupled from localOutbox (sync transport).
// Do NOT add sync-coupled columns here.
// Do NOT add ON DELETE CASCADE from entity tables — events must survive entity deletion.
// Renamed from `domain_events` in change `rename-domain-events-table` to reflect
// the broader scope already covered by this table (domain + system events).

import { sqliteTable, text, index } from "drizzle-orm/sqlite-core";
import { reviews } from "./review";

export const actorType = ["user", "integration", "system"] as const;
// `local` is set at insert time by `LocalMutation.commit()` when the
// `EventCatalogEntry` for `event.type` has `local: true`. The future event
// pusher (Rust sync engine) MUST filter `WHERE status != 'local'` so flagged
// events stay on the device by design.
export const eventStatus = ["pending", "synced", "failed", "local"] as const;
export const eventSource = [
  "peaky.client",
  "peaky.sync",
  "peaky.system",
] as const;

export const events = sqliteTable(
  "events",
  {
    id: text("id").primaryKey(),
    // CloudEvents v1.0.2 core attribute — always "1.0" for now.
    specversion: text("specversion").notNull().default("1.0"),
    // CloudEvents `dataschema` — URL pointing to the JSON Schema for `data`.
    // Nullable for legacy rows that pre-date envelope persistence.
    dataschema: text("dataschema"),
    // reviewId is nullable — events survive review deletion for audit trail.
    reviewId: text("review_id"),
    eventType: text("event_type").notNull(),
    actorType: text("actor_type", { enum: actorType }).notNull(),
    actorId: text("actor_id").notNull(),
    // Browser session identifier — nullable for non-client-sourced events.
    clientId: text("client_id"),
    data: text("data"),
    time: text("time")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    status: text("status", { enum: eventStatus }).notNull().default("pending"),
    syncedAt: text("synced_at"),
    source: text("source", { enum: eventSource })
      .notNull()
      .default("peaky.client"),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    // HLC for causal ordering: 'wallclock:counter:actorId' (wire format)
    hlc: text("hlc"),
  },
  (table) => ({
    reviewIdx: index("events_review_idx").on(table.reviewId),
    timeIdx: index("events_time_idx").on(table.time),
    statusIdx: index("events_status_idx").on(table.status),
    entityTimeIdx: index("events_entity_time_idx").on(
      table.entityType,
      table.time
    ),
  })
);

// Draft answer imports with provenance
export const draftAnswerImports = sqliteTable(
  "draft_answer_imports",
  {
    id: text("id").primaryKey(),
    reviewId: text("review_id")
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
    source: text("source").notNull(),
    runId: text("run_id"),
    importedAt: text("imported_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    actorId: text("actor_id").notNull(),
  },
  (table) => ({
    reviewIdx: index("draft_answer_imports_review_idx").on(table.reviewId),
    sourceIdx: index("draft_answer_imports_source_idx").on(table.source),
  })
);

// Evidence for draft answers
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
    importIdx: index("draft_answer_evidence_import_idx").on(table.importId),
    questionIdx: index("draft_answer_evidence_question_idx").on(
      table.questionId
    ),
  })
);
