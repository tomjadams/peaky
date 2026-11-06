/**
 * Event schema catalog.
 *
 * Maps every domain event type to its Zod schema for the `data` payload.
 * Used by:
 *
 * - `scripts/generate-event-schemas.ts` — emits JSON Schema files served at `dataschema` URLs
 * - Future tooling that needs a machine-readable event inventory
 *
 * Type naming convention: `EventName.v1` (PascalCase + version suffix).
 */
import type { ZodTypeAny } from "zod";
import type {
  DomainEvent,
  DomainEventEnvelope,
} from "~/services/events/DomainEvent";
import {
  reviewAnswerRecordedDataSchema,
  reviewCheckpointSavedDataSchema,
  reviewNoteRecordedDataSchema,
  reviewNoteDeletedDataSchema,
  reviewAttachmentUploadedDataSchema,
  reviewAttachmentDeletedDataSchema,
  reviewProgressUpdatedDataSchema,
  reviewCreatedDataSchema,
  reviewArchivedDataSchema,
  reviewRestoredDataSchema,
  reviewDeletedDataSchema,
} from "./review";
import {
  productCreatedDataSchema,
  productUpdatedDataSchema,
  productArchivedDataSchema,
  productRestoredDataSchema,
  productDeletedDataSchema,
} from "./product";
import {
  templateDraftCreatedDataSchema,
  templateDraftUpdatedDataSchema,
  templateDraftDeletedDataSchema,
  templatePublishedDataSchema,
  templateImportedDataSchema,
  templatePillarCreatedDataSchema,
  templatePillarUpdatedDataSchema,
  templatePillarDeletedDataSchema,
  templateQuestionCreatedDataSchema,
  templateQuestionUpdatedDataSchema,
  templateQuestionDeletedDataSchema,
} from "./template";
import {
  clientSchemaMigratedDataSchema,
  localDbInitializingDataSchema,
  localDbReadyDataSchema,
  localDbBootstrapStartedDataSchema,
  localDbRecreatedDataSchema,
  localDbMigrationFailedDataSchema,
  opfsQuotaWarningDataSchema,
  opfsStorageMeasuredDataSchema,
  syncCycleStartedDataSchema,
  syncCycleSucceededDataSchema,
  syncCycleFailedDataSchema,
  entitlementsRefreshedDataSchema,
} from "./system";

/**
 * Authoring shape for one catalog row, parameterised by the event-type
 * literal `K`. The `entityType` field is narrowed via Extract to the
 * entityType of whichever DomainEvent member has that type — so writing
 * `"ReviewAnswerRecorded.v1": { entityType: "product" }` is a compile
 * error. This is what lets `createEvent`/`emitSystemEvent` derive
 * entityType from the catalog instead of accepting it as a parallel
 * parameter at every call site.
 */
type EventCatalogValue<K extends DomainEvent["type"]> = {
  /** Human-readable description of when and why this event is emitted. */
  description: string;
  /** Sources that can emit this event. Constrained to the known CloudEvents source values. */
  sources: Array<DomainEventEnvelope["source"]>;
  /** Zod schema for the event's `data` payload. */
  schema: ZodTypeAny;
  /**
   * Required. When `true`, events of this type are inserted with `status: "local"` by
   * `LocalMutation.commit()` / `emitSystemEvent()` and the future event push
   * pipeline (Rust sync engine) MUST skip them. Use for browser-only signals
   * that are meaningless to other actors (DB lifecycle, OPFS measurement,
   * recreate-DB).
   *
   * When `false`, events are inserted with `status: "pending"` and are eligible
   * for the future push pipeline (sync-ops events, user-action events).
   *
   * Every entry MUST set this explicitly — no silent default.
   */
  local: boolean;
  /**
   * Entity kind for this event type, narrowed from the matching DomainEvent
   * member. Authors set this once per catalog entry; `createEvent` and
   * `emitSystemEvent` look it up from here so call sites no longer pass it
   * as a parallel argument (eliminating literal-string drift).
   */
  entityType: Extract<DomainEvent, { type: K }>["entityType"];
};

/**
 * Exhaustive registry shape: one entry per type in the `DomainEvent`
 * discriminated union. Adding an event interface to the union without
 * registering it here is a compile error; registering an unknown type or
 * making a typo is also a compile error.
 *
 * The `satisfies` clause on `EVENT_CATALOG` below is what enforces this —
 * the type itself is internal because consumers should use either the
 * `EventCatalogEntry` (denormalised with `type`) or the type-keyed
 * `EVENT_CATALOG` directly.
 */

/**
 * Consumer-facing entry — the catalog value plus its `type` key. Returned
 * from `findCatalogEntryByType()` and held in the iterable
 * `EVENT_CATALOG_ENTRIES` array. Authors do NOT write this shape; they
 * write the `EVENT_CATALOG` keyed object below.
 *
 * `entityType` widens to `DomainEvent["entityType"]` here (vs the per-key
 * narrowing inside `EVENT_CATALOG`) so the iterable view stays ergonomic.
 * For type-narrow access, read `EVENT_CATALOG[key]` directly.
 */
export interface EventCatalogEntry {
  type: DomainEvent["type"];
  description: string;
  sources: Array<DomainEventEnvelope["source"]>;
  schema: ZodTypeAny;
  local: boolean;
  entityType: DomainEvent["entityType"];
}

export const EVENT_CATALOG = {
  // ── Review operations ──────────────────────────────────────
  "ReviewAnswerRecorded.v1": {
    description:
      "Emitted when a user records or updates a single answer within a review. Also emitted when an answer is cleared (answer: null).",
    sources: ["peaky.client"],
    schema: reviewAnswerRecordedDataSchema,
    local: false,
    entityType: "review_answer",
  },
  "ReviewCheckpointSaved.v1": {
    description:
      "Emitted when a batch of answers is committed as a checkpoint, capturing overall progress at that moment.",
    sources: ["peaky.client"],
    schema: reviewCheckpointSavedDataSchema,
    local: false,
    entityType: "review_checkpoint",
  },
  "ReviewNoteRecorded.v1": {
    description:
      "Emitted when a free-text note is created or updated for a question, pillar, or review scope. Note content is subject to GDPR erasure.",
    sources: ["peaky.client"],
    schema: reviewNoteRecordedDataSchema,
    local: false,
    entityType: "review_note",
  },
  "ReviewNoteDeleted.v1": {
    description: "Emitted when a note is deleted from a review scope.",
    sources: ["peaky.client"],
    schema: reviewNoteDeletedDataSchema,
    local: false,
    entityType: "review_note",
  },
  "ReviewAttachmentUploaded.v1": {
    description:
      "Emitted when a file attachment is uploaded and linked to a review scope.",
    sources: ["peaky.client"],
    schema: reviewAttachmentUploadedDataSchema,
    local: false,
    entityType: "review_attachment",
  },
  "ReviewAttachmentDeleted.v1": {
    description: "Emitted when an attachment is removed from a review scope.",
    sources: ["peaky.client"],
    schema: reviewAttachmentDeletedDataSchema,
    local: false,
    entityType: "review_attachment",
  },
  "ReviewProgressUpdated.v1": {
    description:
      "Emitted when per-pillar progress is recomputed, typically after a checkpoint save.",
    sources: ["peaky.client"],
    schema: reviewProgressUpdatedDataSchema,
    local: false,
    entityType: "review",
  },
  // ── Review lifecycle ───────────────────────────────────────
  "ReviewCreated.v1": {
    description:
      "Emitted when a new review is created, including the selected templates and subject.",
    sources: ["peaky.client"],
    schema: reviewCreatedDataSchema,
    local: false,
    entityType: "review",
  },
  "ReviewArchived.v1": {
    description:
      "Emitted when a review is archived and removed from active work.",
    sources: ["peaky.client"],
    schema: reviewArchivedDataSchema,
    local: false,
    entityType: "review",
  },
  "ReviewRestored.v1": {
    description:
      "Emitted when an archived review is restored to active status.",
    sources: ["peaky.client"],
    schema: reviewRestoredDataSchema,
    local: false,
    entityType: "review",
  },
  "ReviewDeleted.v1": {
    description:
      "Emitted when a review is permanently deleted and cannot be recovered.",
    sources: ["peaky.client"],
    schema: reviewDeletedDataSchema,
    local: false,
    entityType: "review",
  },
  // ── Product lifecycle ──────────────────────────────────────
  "ProductCreated.v1": {
    description:
      "Emitted when a new product is created via the product wizard, including its initial team and application assignments.",
    sources: ["peaky.client"],
    schema: productCreatedDataSchema,
    local: false,
    entityType: "product",
  },
  "ProductUpdated.v1": {
    description:
      "Emitted when product metadata is changed. Only the modified fields are included in `changes`.",
    sources: ["peaky.client"],
    schema: productUpdatedDataSchema,
    local: false,
    entityType: "product",
  },
  "ProductArchived.v1": {
    description: "Emitted when a product is archived.",
    sources: ["peaky.client"],
    schema: productArchivedDataSchema,
    local: false,
    entityType: "product",
  },
  "ProductRestored.v1": {
    description: "Emitted when an archived product is restored.",
    sources: ["peaky.client"],
    schema: productRestoredDataSchema,
    local: false,
    entityType: "product",
  },
  "ProductDeleted.v1": {
    description: "Emitted when a product is permanently deleted.",
    sources: ["peaky.client"],
    schema: productDeletedDataSchema,
    local: false,
    entityType: "product",
  },
  // ── Template lifecycle ─────────────────────────────────────
  "TemplateDraftCreated.v1": {
    description: "Emitted when a new template draft is created.",
    sources: ["peaky.client"],
    schema: templateDraftCreatedDataSchema,
    local: false,
    entityType: "template_draft",
  },
  "TemplateDraftUpdated.v1": {
    description:
      "Emitted when template draft metadata is changed. Only the modified fields are included in `changes`.",
    sources: ["peaky.client"],
    schema: templateDraftUpdatedDataSchema,
    local: false,
    entityType: "template_draft",
  },
  "TemplateDraftDeleted.v1": {
    description: "Emitted when a template draft is permanently deleted.",
    sources: ["peaky.client"],
    schema: templateDraftDeletedDataSchema,
    local: false,
    entityType: "template_draft",
  },
  "TemplatePublished.v1": {
    description:
      "Emitted when a template draft is promoted to published, making it available for use in reviews.",
    sources: ["peaky.client"],
    schema: templatePublishedDataSchema,
    local: false,
    entityType: "template_draft",
  },
  "TemplateImported.v1": {
    description:
      "Emitted when a template is imported from an external source (e.g. JSON file upload).",
    sources: ["peaky.client"],
    schema: templateImportedDataSchema,
    local: false,
    entityType: "template_draft",
  },
  "TemplatePillarCreated.v1": {
    description: "Emitted when a new pillar is added to a template draft.",
    sources: ["peaky.client"],
    schema: templatePillarCreatedDataSchema,
    local: false,
    entityType: "template_pillar",
  },
  "TemplatePillarUpdated.v1": {
    description:
      "Emitted when a template pillar's metadata is changed. Only modified fields are included in `changes`.",
    sources: ["peaky.client"],
    schema: templatePillarUpdatedDataSchema,
    local: false,
    entityType: "template_pillar",
  },
  "TemplatePillarDeleted.v1": {
    description: "Emitted when a pillar is removed from a template draft.",
    sources: ["peaky.client"],
    schema: templatePillarDeletedDataSchema,
    local: false,
    entityType: "template_pillar",
  },
  "TemplateQuestionCreated.v1": {
    description:
      "Emitted when a new question is added to a pillar within a template draft.",
    sources: ["peaky.client"],
    schema: templateQuestionCreatedDataSchema,
    local: false,
    entityType: "template_question",
  },
  "TemplateQuestionUpdated.v1": {
    description:
      "Emitted when a template question's content or settings are changed. Only modified fields are included in `changes`.",
    sources: ["peaky.client"],
    schema: templateQuestionUpdatedDataSchema,
    local: false,
    entityType: "template_question",
  },
  "TemplateQuestionDeleted.v1": {
    description: "Emitted when a question is removed from a template pillar.",
    sources: ["peaky.client"],
    schema: templateQuestionDeletedDataSchema,
    local: false,
    entityType: "template_question",
  },
  // ── System events — DB lifecycle (local: true) ─────────────
  "LocalDbInitializing.v1": {
    description:
      "Emitted at the start of local SQLite bootstrap. Per-browser ephemeral; stays on the device.",
    sources: ["peaky.system"],
    schema: localDbInitializingDataSchema,
    local: true,
    entityType: "local_db",
  },
  "LocalDbReady.v1": {
    description:
      "Emitted when the local database is ready for reads/writes. Carries the cold-start duration so the /system Database tile can show readiness latency.",
    sources: ["peaky.system"],
    schema: localDbReadyDataSchema,
    local: true,
    entityType: "local_db",
  },
  "LocalDbBootstrapStarted.v1": {
    description:
      "Emitted by the client plugin at the start of warmup. The `isRecreate` flag distinguishes a normal load from a post-recreate-DB reload.",
    sources: ["peaky.system"],
    schema: localDbBootstrapStartedDataSchema,
    local: true,
    entityType: "local_db",
  },
  "LocalDbRecreated.v1": {
    description:
      "Emitted on the first ready signal after a user-triggered recreate-DB reload. Used by the /system Maintenance card to display 'Last recreated: …'.",
    sources: ["peaky.system"],
    schema: localDbRecreatedDataSchema,
    local: true,
    entityType: "local_db",
  },
  "LocalDbMigrationFailed.v1": {
    description:
      "Emitted by the migration runner when a single or bundle migration throws. Pairs with the corresponding `_migration_log` row; the event is the visible signal, the log is the local diagnostic.",
    sources: ["peaky.system"],
    schema: localDbMigrationFailedDataSchema,
    local: true,
    entityType: "schema",
  },
  "ClientSchemaMigrated.v1": {
    description:
      "Emitted by the client migration runner after applying one or more pending schema migrations on startup. Not emitted when no migrations are pending.",
    sources: ["peaky.system"],
    schema: clientSchemaMigratedDataSchema,
    local: true,
    entityType: "schema",
  },
  // ── System events — storage (local: true) ──────────────────
  "OpfsQuotaWarning.v1": {
    description:
      "Emitted when an OPFS measurement crosses the 80% quota threshold. Per-browser storage state, never pushed.",
    sources: ["peaky.system"],
    schema: opfsQuotaWarningDataSchema,
    local: true,
    entityType: "storage",
  },
  "OpfsStorageMeasured.v1": {
    description:
      "Emitted whenever the /system page or a sync cycle measures OPFS usage. Carries `supported: false` when navigator.storage.estimate is unavailable.",
    sources: ["peaky.system"],
    schema: opfsStorageMeasuredDataSchema,
    local: true,
    entityType: "storage",
  },
  // ── System events — sync ops (push-eligible) ───────────────
  "SyncCycleStarted.v1": {
    description:
      "Emitted at the start of `SyncEngine.runSyncCycle()`. Pairs with SyncCycleSucceeded.v1 or SyncCycleFailed.v1 via cycleId. Push-eligible so postmortems can correlate which session synced what.",
    sources: ["peaky.system"],
    schema: syncCycleStartedDataSchema,
    local: false,
    entityType: "sync_cycle",
  },
  "SyncCycleSucceeded.v1": {
    description:
      "Emitted when the sync cycle completes successfully. Carries the eventsPushed/eventsPulled counts and durationMs that drive the /system Sync tile.",
    sources: ["peaky.system"],
    schema: syncCycleSucceededDataSchema,
    local: false,
    entityType: "sync_cycle",
  },
  "SyncCycleFailed.v1": {
    description:
      "Emitted when the sync cycle throws or returns a failed result. Error messages are sanitised at the emission site (no stack traces, no embedded values).",
    sources: ["peaky.system"],
    schema: syncCycleFailedDataSchema,
    local: false,
    entityType: "sync_cycle",
  },
  "EntitlementsRefreshed.v1": {
    description:
      "Emitted on a successful entitlement refresh. Used by the admin feed to correlate sudden permission shifts with the refresh moment.",
    sources: ["peaky.system"],
    schema: entitlementsRefreshedDataSchema,
    local: false,
    entityType: "entitlements",
  },
} satisfies { [K in DomainEvent["type"]]: EventCatalogValue<K> };

/**
 * Iterable, denormalised view of the catalog — each entry carries its
 * `type` key as a field for ergonomic iteration (table rendering, JSON
 * Schema generation, contract tests). Built once at module load.
 *
 * Authors should NOT add new entries here; add them to `EVENT_CATALOG`
 * above and the `satisfies EventCatalogMap` clause will enforce that the
 * key is a real `DomainEvent["type"]`.
 */
export const EVENT_CATALOG_ENTRIES: ReadonlyArray<EventCatalogEntry> =
  Object.entries(EVENT_CATALOG).map(([type, value]) =>
    Object.assign({ type: type as DomainEvent[`type`] }, value)
  );

/** Look up a catalog entry by its event type string (e.g. `"ProductCreated.v1"`). */
export function findCatalogEntryByType(
  type: string
): EventCatalogEntry | undefined {
  if (!(type in EVENT_CATALOG)) return undefined;
  const value = (EVENT_CATALOG as unknown as Record<string, EventCatalogEntry>)[
    type
  ];
  return value ? { ...value, type: type as DomainEvent["type"] } : undefined;
}

/**
 * Resolve the entityType for an event type at runtime, narrowed to the
 * matching DomainEvent member's entityType when `T` is known.
 *
 * Used by `createEvent` and `emitSystemEvent` so callers no longer pass
 * entityType as a parallel argument — the catalog is the single source of
 * truth and a literal-string typo at the call site cannot diverge from
 * the type registry.
 */

export function getCatalogEntityType<T extends DomainEvent["type"]>(
  type: T
): Extract<DomainEvent, { type: T }>["entityType"] {
  const entityType = (
    EVENT_CATALOG as unknown as Record<string, { entityType: string }>
  )[type]!.entityType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- boundary cast; EVENT_CATALOG typing catches authoring mistakes
  return entityType as any;
}

// Built once at module load — O(1) per call vs O(n) Array.find.
// Set<string> (not Set<DomainEvent["type"]>) so `.has(unknownString)` is
// valid — the function below accepts `string` so unregistered types
// return false rather than failing to compile.
const LOCAL_CATALOG_TYPES = new Set<string>(
  Object.entries(EVENT_CATALOG)
    .filter(([, value]) => value.local)
    .map(([type]) => type)
);

/**
 * Returns `true` when the catalog entry for this event type has `local: true`.
 * Returns `false` for push-eligible types and for unregistered types (safe default).
 */
export function isLocalCatalogEvent(type: string): boolean {
  return LOCAL_CATALOG_TYPES.has(type);
}
