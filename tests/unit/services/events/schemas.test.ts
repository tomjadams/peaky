/**
 * Contract tests for the event schema catalog.
 *
 * These tests act as a living contract between:
 * - `app/services/events/DomainEvent.ts` — TypeScript interfaces (compile-time truth)
 * - `app/services/events/schemas/` — Zod schemas (runtime + JSON Schema truth)
 *
 * A test failure here means the Zod schema has drifted from the interface — fix both.
 * Schema payload validation tests are split into:
 *   - schemas-review.test.ts — review operations and lifecycle
 *   - schemas-domain.test.ts — product, template, and system event payloads
 */
import { describe, it, expect } from "vitest";
import {
  EVENT_CATALOG,
  EVENT_CATALOG_ENTRIES,
  findCatalogEntryByType,
  isLocalCatalogEvent,
} from "~/services/events/schemas/index";
import { buildDataSchemaUrl } from "~/services/events/config";

// Per-design contract: every DB-lifecycle and storage event MUST have
// `local: true` so it stays on the device by design. Sync-ops events MUST
// have `local: false` — they sync to the server so postmortems can
// correlate which session synced what.
const LOCAL_ONLY_SYSTEM_EVENTS = [
  "LocalDbInitializing.v1",
  "LocalDbReady.v1",
  "LocalDbBootstrapStarted.v1",
  "LocalDbRecreated.v1",
  "LocalDbMigrationFailed.v1",
  "ClientSchemaMigrated.v1",
  "OpfsQuotaWarning.v1",
  "OpfsStorageMeasured.v1",
] as const;
const PUSH_ELIGIBLE_SYNC_OPS_EVENTS = [
  "SyncCycleStarted.v1",
  "SyncCycleSucceeded.v1",
  "SyncCycleFailed.v1",
  "EntitlementsRefreshed.v1",
] as const;

// ─── Catalog completeness ─────────────────────────────────────

describe("EVENT_CATALOG_ENTRIES completeness", () => {
  it("has no duplicate type values", () => {
    const types = EVENT_CATALOG_ENTRIES.map((e) => e.type);
    const unique = new Set(types);
    expect(unique.size).toBe(types.length);
  });

  it("every type ends with '.v1'", () => {
    for (const entry of EVENT_CATALOG_ENTRIES) {
      expect(entry.type).toMatch(/\.v1$/);
    }
  });

  it("every entry has a non-empty description", () => {
    for (const entry of EVENT_CATALOG_ENTRIES) {
      expect(entry.description.trim().length).toBeGreaterThan(0);
    }
  });

  it("every entry has at least one source", () => {
    for (const entry of EVENT_CATALOG_ENTRIES) {
      expect(entry.sources.length).toBeGreaterThan(0);
    }
  });

  it("every entry has an explicit local boolean (no silent default)", () => {
    // Assert against the keyed source of truth as well as the
    // denormalised array — `EVENT_CATALOG_ENTRIES` is built from
    // `Object.entries(EVENT_CATALOG)` and an undefined `local` would
    // surface as `typeof "undefined"` here, but the keyed check
    // separately documents intent.
    for (const [, value] of Object.entries(EVENT_CATALOG)) {
      expect(value).toHaveProperty("local");
      expect(typeof value.local).toBe("boolean");
    }
    for (const entry of EVENT_CATALOG_ENTRIES) {
      expect(typeof entry.local).toBe("boolean");
    }
  });

  it("denormalised entries are the same length as the keyed catalog", () => {
    expect(EVENT_CATALOG_ENTRIES.length).toBe(
      Object.keys(EVENT_CATALOG).length
    );
  });
});

// ─── Lookups ──────────────────────────────────────────────────

describe("findCatalogEntryByType", () => {
  it("returns the correct entry", () => {
    const entry = findCatalogEntryByType("ProductCreated.v1");
    expect(entry?.type).toBe("ProductCreated.v1");
  });

  it("returns undefined for unknown type", () => {
    expect(findCatalogEntryByType("unknown.event")).toBeUndefined();
  });

  it("returns the same schema/description/sources/local as EVENT_CATALOG[key]", () => {
    // The denormalised entry must structurally match the keyed catalog —
    // anyone replacing one source-of-truth without the other should fail
    // here.
    for (const entry of EVENT_CATALOG_ENTRIES) {
      const fromKeyed = EVENT_CATALOG[entry.type as keyof typeof EVENT_CATALOG];
      expect(entry.schema).toBe(fromKeyed.schema);
      expect(entry.description).toBe(fromKeyed.description);
      expect(entry.sources).toEqual(fromKeyed.sources);
      expect(entry.local).toBe(fromKeyed.local);
    }
  });
});

describe("isLocalCatalogEvent", () => {
  it("returns true for every catalog entry with local: true", () => {
    for (const eventType of LOCAL_ONLY_SYSTEM_EVENTS) {
      expect(isLocalCatalogEvent(eventType)).toBe(true);
    }
  });

  it("returns false for every push-eligible sync-ops event", () => {
    for (const eventType of PUSH_ELIGIBLE_SYNC_OPS_EVENTS) {
      expect(isLocalCatalogEvent(eventType)).toBe(false);
    }
  });

  it("returns false for review/product/template domain events (push-eligible by design)", () => {
    expect(isLocalCatalogEvent("ProductCreated.v1")).toBe(false);
    expect(isLocalCatalogEvent("ReviewAnswerRecorded.v1")).toBe(false);
    expect(isLocalCatalogEvent("TemplateCreated.v1")).toBe(false);
  });

  it("returns false for unregistered types (safe default)", () => {
    expect(isLocalCatalogEvent("not-a-real-event")).toBe(false);
    expect(isLocalCatalogEvent("")).toBe(false);
  });

  it("matches EVENT_CATALOG[key].local for every registered type", () => {
    // Catches any drift between the precomputed Set and the source of truth.
    for (const [type, value] of Object.entries(EVENT_CATALOG)) {
      expect(isLocalCatalogEvent(type)).toBe(value.local);
    }
  });
});

// ─── buildDataSchemaUrl ───────────────────────────────────────

describe("buildDataSchemaUrl", () => {
  it("produces a well-formed HTTPS URL with the correct schema path for every catalog entry", () => {
    for (const entry of EVENT_CATALOG_ENTRIES) {
      const url = buildDataSchemaUrl(entry.type);
      expect(url).toMatch(/^https?:\/\//);
      expect(url).toContain(`/schemas/${entry.type}.json`);
    }
  });
});

// ─── System events — `local` flag contract ────────────────────

describe("System event `local` flag contract", () => {
  it.each(LOCAL_ONLY_SYSTEM_EVENTS)(
    "%s is flagged local: true (per-browser, never pushed)",
    (eventType) => {
      const entry = findCatalogEntryByType(eventType)!;
      expect(entry.local).toBe(true);
    }
  );

  it.each(PUSH_ELIGIBLE_SYNC_OPS_EVENTS)(
    "%s is push-eligible (local: false)",
    (eventType) => {
      const entry = findCatalogEntryByType(eventType)!;
      expect(entry.local).toBe(false);
    }
  );
});
