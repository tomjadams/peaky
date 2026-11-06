import { sql } from "drizzle-orm";
import { createUuidV7 } from "~/local-db";
import { fieldVersionEvents, fieldVersions } from "#shared/db/schema";
import type { DomainEventEnvelope } from "~/services/events/DomainEvent";
import type { MutationTransaction } from "~/services/local-mutation";
import type { PulledEvent, PulledField } from "./types";

/** Editing-session window in seconds. Rapid saves within this window preserve
 *  the original previousValue so Recent Changes shows the full transition. */
export const PREV_VALUE_WINDOW_SECS = 5;
const MAX_JSON_COMPARE_DEPTH = 50;

export interface LatestFieldVersionEvent {
  value: string | null;
  previousValue: string | null;
  actorId: string;
  updatedAt: string;
}

export interface FieldVersionWrite {
  eventId: string;
  entityType: string;
  entityId: string;
  fieldName: string;
  value: string | null;
  hlc: string;
  actorId: string;
  updatedAt: string;
}

interface FieldVersionLookup {
  entityType: string;
  entityId: string;
  fieldName: string;
  atOrBefore?: string;
}

function stableJson(
  value: unknown,
  seen = new WeakSet<object>(),
  depth = 0
): string {
  if (depth > MAX_JSON_COMPARE_DEPTH) return JSON.stringify(value);
  if (value && typeof value === "object") {
    if (seen.has(value)) return '"[Circular]"';
    seen.add(value);
  }
  if (Array.isArray(value)) {
    return `[${value
      .map((item) => stableJson(item, seen, depth + 1))
      .toSorted()
      .join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).toSorted(
      ([a], [b]) => a.localeCompare(b)
    );
    return `{${entries
      .map(
        ([key, entryValue]) =>
          `${JSON.stringify(key)}:${stableJson(entryValue, seen, depth + 1)}`
      )
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function areJsonFieldValuesEqual(
  a: string | null,
  b: string | null
): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  try {
    return stableJson(JSON.parse(a)) === stableJson(JSON.parse(b));
  } catch {
    return false;
  }
}

/**
 * Computes the `previousValue` for a new field_versions row by reading the
 * latest existing row for the same entity/field and applying the editing-window rules.
 *
 * - No existing row → null (first write)
 * - Value changed AND different actor → capture existing value as previousValue
 * - Value changed AND same actor AND >PREV_VALUE_WINDOW_SECS since last update → new session → capture existing value
 * - Value changed AND same actor AND within window → carry forward existing previousValue
 * - Value unchanged → carry forward existing previousValue
 */
export function computePreviousValue(
  latest: LatestFieldVersionEvent | undefined,
  newValue: string | null,
  newActorId: string,
  newUpdatedAt: string
): string | null {
  if (!latest) return null;
  if (areJsonFieldValuesEqual(newValue, latest.value)) {
    return latest.previousValue;
  }
  const isDifferentActor = newActorId !== latest.actorId;
  const latestMs = Date.parse(latest.updatedAt);
  const newMs = Date.parse(newUpdatedAt);
  const secsSinceLastUpdate =
    Number.isFinite(latestMs) && Number.isFinite(newMs)
      ? (newMs - latestMs) / 1000
      : PREV_VALUE_WINDOW_SECS + 1;
  if (
    isDifferentActor ||
    secsSinceLastUpdate < 0 ||
    secsSinceLastUpdate > PREV_VALUE_WINDOW_SECS
  ) {
    return latest.value;
  }
  return latest.previousValue;
}

/**
 * Reads the latest history row for a given entity/field.
 * Returns undefined if no row exists.
 */
export async function readLatestFieldVersionEvent(
  tx: MutationTransaction,
  lookup: FieldVersionLookup
): Promise<LatestFieldVersionEvent | undefined> {
  const baseWhere = sql`${fieldVersionEvents.entityType} = ${lookup.entityType} AND ${fieldVersionEvents.entityId} = ${lookup.entityId} AND ${fieldVersionEvents.fieldName} = ${lookup.fieldName}`;
  const rows = await tx
    .select({
      value: fieldVersionEvents.value,
      previousValue: fieldVersionEvents.previousValue,
      actorId: fieldVersionEvents.actorId,
      updatedAt: fieldVersionEvents.updatedAt,
    })
    .from(fieldVersionEvents)
    .where(
      lookup.atOrBefore
        ? sql`${baseWhere} AND ${fieldVersionEvents.updatedAt} <= ${lookup.atOrBefore}`
        : baseWhere
    )
    .orderBy(
      sql`${fieldVersionEvents.updatedAt} DESC, ${fieldVersionEvents.id} DESC`
    )
    .limit(1);
  return rows[0] as LatestFieldVersionEvent | undefined;
}

export async function recordFieldVersionEvent(
  tx: MutationTransaction,
  write: FieldVersionWrite
): Promise<void> {
  const latest = await readLatestFieldVersionEvent(tx, {
    entityType: write.entityType,
    entityId: write.entityId,
    fieldName: write.fieldName,
    atOrBefore: write.updatedAt,
  });

  if (!latest && write.value === null) return;
  if (latest && areJsonFieldValuesEqual(write.value, latest.value)) return;

  const previousValue = computePreviousValue(
    latest,
    write.value,
    write.actorId,
    write.updatedAt
  );

  await tx
    .insert(fieldVersionEvents)
    .values({
      id: createUuidV7(),
      eventId: write.eventId,
      entityType: write.entityType,
      entityId: write.entityId,
      fieldName: write.fieldName,
      value: write.value,
      previousValue,
      hlc: write.hlc,
      actorId: write.actorId,
      updatedAt: write.updatedAt,
    })
    .onConflictDoNothing({
      target: [fieldVersionEvents.eventId, fieldVersionEvents.fieldName],
    });
}

export async function upsertCurrentFieldVersion(
  tx: MutationTransaction,
  write: FieldVersionWrite
): Promise<void> {
  await tx
    .insert(fieldVersions)
    .values({
      id: createUuidV7(),
      entityType: write.entityType,
      entityId: write.entityId,
      fieldName: write.fieldName,
      value: write.value,
      hlc: write.hlc,
      actorId: write.actorId,
      updatedAt: write.updatedAt,
    })
    .onConflictDoUpdate({
      target: [
        fieldVersions.entityType,
        fieldVersions.entityId,
        fieldVersions.fieldName,
      ],
      set: {
        value: write.value,
        hlc: write.hlc,
        actorId: write.actorId,
        updatedAt: write.updatedAt,
      },
      where: sql`excluded.hlc > ${fieldVersions.hlc} OR (excluded.hlc = ${fieldVersions.hlc} AND excluded.actor_id > ${fieldVersions.actorId})`,
    });
}

export async function applyFieldVersionWrite(
  tx: MutationTransaction,
  write: FieldVersionWrite
): Promise<void> {
  await recordFieldVersionEvent(tx, write);
  await upsertCurrentFieldVersion(tx, write);
}

/**
 * Applies current field state and append-only history for all fields in a pulled event.
 *
 * Called inside a Drizzle transaction from each inbound handler.
 */
export async function upsertFieldVersions(
  tx: MutationTransaction,
  event: PulledEvent
): Promise<void> {
  for (const field of event.fields) {
    await applyFieldVersionWrite(tx, {
      eventId: event.id,
      entityType: event.entityType,
      entityId: event.entityId,
      fieldName: field.name,
      value: field.value,
      hlc: field.hlc,
      actorId: event.actorId,
      updatedAt: event.time,
    });
  }
}

/**
 * Best-effort upsertFieldVersions: field history must not block the domain
 * row write. Failures are logged in dev and swallowed.
 */
export async function tryUpsertFieldVersions(
  tx: MutationTransaction,
  event: PulledEvent,
  tag: string
): Promise<void> {
  try {
    await upsertFieldVersions(tx, event);
  } catch (err) {
    if (import.meta.dev) {
      console.warn(`[${tag}] upsertFieldVersions failed:`, err);
    }
  }
}

/**
 * Converts PulledField[] to a plain object map: fieldName → parsed value.
 * Values are JSON-parsed if parseable, otherwise kept as strings.
 */
export function toFieldMap(fields: PulledField[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.value === null) {
      out[f.name] = null;
    } else {
      try {
        out[f.name] = JSON.parse(f.value) as unknown;
      } catch {
        out[f.name] = f.value;
      }
    }
  }
  return out;
}

/** Builds the synthetic replay event envelope from a pulled event. */
export function toReplayEvent(
  event: PulledEvent,
  eventType: string,
  /** Extra top-level envelope fields (e.g., reviewId). */
  envelopeExtra: Partial<DomainEventEnvelope> = {}
): DomainEventEnvelope {
  return {
    id: event.id,
    type: eventType,
    specversion: "1.0",
    source: "peaky.sync",
    actorId: event.actorId,
    actorType: "user",
    entityType: event.entityType,
    entityId: event.entityId,
    time: event.time,
    data: { fields: event.fields },
    ...envelopeExtra,
  };
}
