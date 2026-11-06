import {
  createAdminEventActor,
  createAdminEventSubject,
  CURRENT_USER_ADMIN_ACTOR_ID,
  formatAdminEventLabel,
  LifecycleAdminEvent,
  ProductAdminEvent,
  ReviewAdminEvent,
  SystemAdminEvent,
  TemplateAdminEvent,
  type AdminEventRecord,
  type AdminEventSource,
  type AdminEventStatus,
} from "~/admin/events";
import { withDatabase, desc, localOutbox, events } from "~/local-db";
import {
  isRecord,
  parsePayload,
  createLifecycleEventRecord,
  buildLocalAuditEvent,
  buildLocalCreateEvent,
} from "./localEvents-outbox";

type EventRow = typeof events.$inferSelect;
type EventStatus = NonNullable<EventRow["status"]>;

const EVENT_STATUS_TO_ADMIN_STATUS = {
  failed: "failed",
  pending: "pending",
  synced: "synced",
  local: "local",
} satisfies Record<EventStatus, AdminEventStatus>;

function toAdminSource(source: string): AdminEventSource {
  if (source === "peaky.sync") return "peaky.sync";
  if (source === "peaky.system") return "peaky.client";
  return "peaky.client";
}

function parseEventData(data: string | null): Record<string, unknown> {
  if (!data) return {};
  try {
    const parsed = JSON.parse(data) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/** Map an events row to an AdminEventRecord. Exported for unit testing. */
export function eventToAdminRecord(row: EventRow): AdminEventRecord {
  const isReviewScoped = row.entityType?.startsWith("review") ?? false;
  const actionLabel = formatAdminEventLabel(row.eventType);
  const entityId = row.entityId ?? row.reviewId ?? row.id;
  const entityType = row.entityType ?? "review";
  const status = EVENT_STATUS_TO_ADMIN_STATUS[row.status];
  const parsedData = parseEventData(row.data);
  const subjectName =
    typeof parsedData.name === "string" ? parsedData.name : entityId;
  const subjectUrl =
    entityType === "product"
      ? `/products/${entityId}`
      : row.reviewId
        ? `/reviews/${row.reviewId}`
        : undefined;

  // Surface the full CloudEvents envelope in the admin detail panel.
  // Previously only `parsedData` was spread, dropping specversion, source,
  // status, dataschema, clientId, etc. — the v2 wart called out in the
  // roadmap ("Admin Events v2 — Raw Details should expose full envelope").
  // Keep parsedData under a nested `data` key so future readers see the
  // logical separation between envelope and payload.
  const config = {
    id: row.id,
    action: row.eventType,
    actionLabel,
    subject: createAdminEventSubject({
      type: entityType,
      label: formatAdminEventLabel(entityType),
      id: entityId,
      name: subjectName,
      url: subjectUrl,
    }),
    actor: createAdminEventActor({
      id: row.actorId,
      name: row.actorId === CURRENT_USER_ADMIN_ACTOR_ID ? "You" : row.actorId,
      roles: [],
      type: row.actorType,
    }),
    source: toAdminSource(row.source),
    status,
    summary: `${actionLabel} recorded locally.`,
    details: {
      // Envelope (CloudEvents v1.0.2 core + extensions)
      id: row.id,
      type: row.eventType,
      specversion: row.specversion,
      source: row.source,
      dataschema: row.dataschema,
      actorId: row.actorId,
      actorType: row.actorType,
      entityType,
      entityId,
      reviewId: row.reviewId,
      clientId: row.clientId,
      time: row.time,
      status: row.status,
      // Logical payload
      data: parsedData,
    },
    time: row.time,
  };

  let event;
  if (isReviewScoped) {
    event = new ReviewAdminEvent(config);
  } else if (entityType === "product") {
    event = new ProductAdminEvent(config);
  } else if (entityType === "template" || entityType.startsWith("template_")) {
    event = new TemplateAdminEvent(config);
  } else if (
    // Peaky.system events (DB lifecycle, OPFS measurement, sync ops) are
    // observability internals — NOT user-facing lifecycle. Categorise them
    // as "system" so the lifecycle category stays focused on review/product/
    // template lifecycle (archive, restore, delete).
    row.source === "peaky.system" ||
    entityType === "schema" ||
    entityType === "local_db"
  ) {
    event = new SystemAdminEvent(config);
  } else {
    event = new LifecycleAdminEvent(config);
  }

  return event.toRecord();
}

export async function fetchLocalAdminEvents(): Promise<AdminEventRecord[]> {
  const [outboxRows, eventRows] = await Promise.all([
    withDatabase((db) =>
      db.select().from(localOutbox).orderBy(desc(localOutbox.createdAt))
    ),
    withDatabase((db) =>
      db.select().from(events).orderBy(desc(events.time)).limit(200)
    ),
  ]);

  // Track entityIds of pending/failed create outbox entries so the corresponding
  // domain event isn't shown as a duplicate alongside the outbox event.
  const pendingOutboxCreateEntityIds = new Set(
    outboxRows
      .filter((r) => r.operation === "create" && r.status !== "synced")
      .map((r) => r.entityId)
      .filter(Boolean)
  );

  const outboxRecords = outboxRows.flatMap((row) => {
    const payload = parsePayload(row.fields);

    if (payload.audit) {
      return [
        createLifecycleEventRecord(buildLocalAuditEvent(row, payload.audit)),
      ];
    }

    if (row.status === "synced") {
      return [];
    }

    const event = buildLocalCreateEvent(row, payload);
    return event ? [createLifecycleEventRecord(event)] : [];
  });

  const eventRecords = eventRows
    .filter((row) => {
      // Suppress events that are already represented by a pending outbox entry
      if (
        row.eventType.endsWith("Created.v1") &&
        row.entityId &&
        pendingOutboxCreateEntityIds.has(row.entityId)
      ) {
        return false;
      }
      return true;
    })
    .map(eventToAdminRecord);

  return [...outboxRecords, ...eventRecords].toSorted(
    (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
  );
}
