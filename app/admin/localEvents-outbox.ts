import {
  createAdminEventActor,
  createAdminEventSubject,
  formatAdminEventLabel,
  CURRENT_USER_ADMIN_ACTOR_ID,
  LifecycleAdminEvent,
  type AdminEventActor,
  type AdminEventStatus,
} from "~/admin/events";
import {
  DEFAULT_LIFECYCLE_ACTOR,
  getLifecycleSubjectUrl,
  type LifecycleAuditRecord,
} from "~/lifecycle/management";
import type { localOutbox } from "~/local-db";

export type LocalOutboxRow = typeof localOutbox.$inferSelect;
export type LocalOutboxStatus = NonNullable<LocalOutboxRow["status"]>;
export type LocalCreateEntityType = "product" | "review";

export type ParsedOutboxPayload = {
  id?: string;
  name?: string;
  origin?: string;
  isExternal?: boolean;
  productManagerId?: string;
  engineeringLeadId?: string;
  teamIds?: string[];
  componentIds?: string[];
  supportChannel?: string;
  subjectId?: string;
  actorName?: string;
  templateIds?: string[];
  audit?: LifecycleAuditRecord;
};

export type LocalCreateEventBuilder = (
  row: LocalOutboxRow,
  payload: ParsedOutboxPayload
) => LifecycleAdminEvent | null;

export const LOCAL_OUTBOX_STATUS_TO_ADMIN_STATUS = {
  failed: "failed",
  pending: "pending",
  synced: "synced",
  syncing: "pending",
} satisfies Record<LocalOutboxStatus, AdminEventStatus>;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function getOptionalString(
  record: Record<string, unknown>,
  key: string
): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

export function getOptionalStringArray(
  record: Record<string, unknown>,
  key: string
): string[] | undefined {
  const value = record[key];

  if (!Array.isArray(value)) {
    return undefined;
  }

  return value.filter((item): item is string => typeof item === "string");
}

export function getOptionalAudit(
  record: Record<string, unknown>
): LifecycleAuditRecord | undefined {
  const audit = record.audit;

  if (!isRecord(audit)) {
    return undefined;
  }

  return isLifecycleAuditRecord(audit) ? audit : undefined;
}

export function isLifecycleAuditRecord(
  value: unknown
): value is LifecycleAuditRecord {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.action === "string" &&
    typeof value.subjectType === "string" &&
    typeof value.subjectId === "string" &&
    typeof value.subjectName === "string" &&
    typeof value.actorId === "string" &&
    typeof value.actorName === "string" &&
    Array.isArray(value.actorRoles) &&
    typeof value.source === "string" &&
    typeof value.time === "string" &&
    isRecord(value.associatedResources)
  );
}

export function parsePayload(payload: string | null): ParsedOutboxPayload {
  if (!payload) {
    return {};
  }

  try {
    const parsed = JSON.parse(payload) as unknown;

    if (!isRecord(parsed)) {
      return {};
    }

    return {
      id: getOptionalString(parsed, "id"),
      name: getOptionalString(parsed, "name"),
      origin: getOptionalString(parsed, "origin"),
      isExternal:
        typeof parsed.isExternal === "boolean" ? parsed.isExternal : undefined,
      productManagerId: getOptionalString(parsed, "productManagerId"),
      engineeringLeadId: getOptionalString(parsed, "engineeringLeadId"),
      teamIds: getOptionalStringArray(parsed, "teamIds"),
      componentIds: getOptionalStringArray(parsed, "componentIds"),
      supportChannel: getOptionalString(parsed, "supportChannel"),
      subjectId: getOptionalString(parsed, "subjectId"),
      actorName: getOptionalString(parsed, "actorName"),
      templateIds: getOptionalStringArray(parsed, "templateIds"),
      audit: getOptionalAudit(parsed),
    };
  } catch {
    return {};
  }
}

export function toStatus(status: LocalOutboxStatus): AdminEventStatus {
  return LOCAL_OUTBOX_STATUS_TO_ADMIN_STATUS[status];
}

export function createOutboxActor(
  row: LocalOutboxRow,
  payload: ParsedOutboxPayload
): AdminEventActor {
  const actorId = row.actorId ?? DEFAULT_LIFECYCLE_ACTOR.id;
  const actorName = payload.actorName?.trim();

  return createAdminEventActor({
    id: actorId,
    name:
      actorName ??
      (actorId === CURRENT_USER_ADMIN_ACTOR_ID ||
      actorId === DEFAULT_LIFECYCLE_ACTOR.id
        ? DEFAULT_LIFECYCLE_ACTOR.name
        : actorId),
    roles:
      actorId === DEFAULT_LIFECYCLE_ACTOR.id
        ? DEFAULT_LIFECYCLE_ACTOR.roles
        : [],
    type: "user",
  });
}

export function createLifecycleEventRecord(event: LifecycleAdminEvent) {
  return event.toRecord();
}

export function createReviewSubject(
  subjectId: string,
  reviewId: string,
  name: string
) {
  const isTeamReview = subjectId.startsWith("team-");

  return createAdminEventSubject({
    type: isTeamReview ? "team-review" : "product-review",
    label: isTeamReview ? "Team review" : "Product review",
    id: reviewId,
    name,
    url: isTeamReview
      ? `/teams/${subjectId}/reviews/${reviewId}`
      : `/products/${subjectId}/reviews/${reviewId}`,
  });
}

export function createProductSubject(subjectId: string, name: string) {
  return createAdminEventSubject({
    type: "product",
    label: "Product",
    id: subjectId,
    name,
    url: `/products/${subjectId}`,
  });
}

export function buildTemplateSelectionSummary(templateCount: number): string {
  return `Created locally with ${templateCount} template${templateCount === 1 ? "" : "s"} selected.`;
}

export function buildLocalReviewCreateEvent(
  row: LocalOutboxRow,
  payload: ParsedOutboxPayload
): LifecycleAdminEvent | null {
  const subjectId = payload.subjectId;
  const reviewId = payload.id ?? row.entityId;

  if (!subjectId) {
    return null;
  }

  return new LifecycleAdminEvent({
    id: `local-${row.id}`,
    action: "ReviewCreated.v1",
    actionLabel: "Review Created",
    subject: createReviewSubject(subjectId, reviewId, payload.name ?? reviewId),
    actor: createOutboxActor(row, payload),
    source: "peaky.client",
    status: toStatus(row.status),
    summary: buildTemplateSelectionSummary((payload.templateIds ?? []).length),
    details: {
      outboxId: row.id,
      payload,
    },
    time: row.createdAt,
  });
}

export function buildLocalProductCreateEvent(
  row: LocalOutboxRow,
  payload: ParsedOutboxPayload
): LifecycleAdminEvent {
  const subjectId = payload.id ?? row.entityId;
  const name = payload.name ?? subjectId;
  const teamCount = payload.teamIds?.length ?? 0;
  const componentCount = payload.componentIds?.length ?? 0;

  const summaryParts: string[] = [`"${name}" created locally`];
  if (teamCount > 0)
    summaryParts.push(
      `${teamCount} team${teamCount === 1 ? "" : "s"} assigned`
    );
  if (componentCount > 0)
    summaryParts.push(
      `${componentCount} application${componentCount === 1 ? "" : "s"} linked`
    );

  return new LifecycleAdminEvent({
    id: `local-${row.id}`,
    action: "ProductCreated.v1",
    actionLabel: "Product Created",
    subject: createProductSubject(subjectId, name),
    actor: createOutboxActor(row, payload),
    source: "peaky.client",
    status: toStatus(row.status),
    summary: summaryParts.join(" · ") + ".",
    details: {
      outboxId: row.id,
      name: payload.name,
      origin: payload.origin,
      isExternal: payload.isExternal,
      productManagerId: payload.productManagerId,
      engineeringLeadId: payload.engineeringLeadId,
      teamIds: payload.teamIds,
      componentIds: payload.componentIds,
      supportChannel: payload.supportChannel,
    },
    time: row.createdAt,
  });
}

export const LOCAL_CREATE_EVENT_BUILDERS = {
  product: buildLocalProductCreateEvent,
  review: buildLocalReviewCreateEvent,
} satisfies Record<LocalCreateEntityType, LocalCreateEventBuilder>;

export function isLocalCreateEntityType(
  entityType: string
): entityType is LocalCreateEntityType {
  return entityType === "product" || entityType === "review";
}

export function createAuditSubject(audit: LifecycleAuditRecord) {
  return createAdminEventSubject({
    type: audit.subjectType,
    label: formatAdminEventLabel(audit.subjectType),
    id: audit.subjectId,
    name: audit.subjectName,
    url:
      audit.action === "delete"
        ? undefined
        : getLifecycleSubjectUrl(audit.subjectType, audit.subjectId),
  });
}

export function buildLocalAuditEvent(
  row: LocalOutboxRow,
  audit: LifecycleAuditRecord
): LifecycleAdminEvent {
  const actionLabel = formatAdminEventLabel(audit.action);

  return new LifecycleAdminEvent({
    id: `local-${row.id}`,
    action: audit.action,
    actionLabel,
    subject: createAuditSubject(audit),
    actor: createAdminEventActor({
      id: audit.actorId,
      name: audit.actorName,
      roles: audit.actorRoles,
      type: "user",
    }),
    source: audit.source,
    status: toStatus(row.status),
    summary: `${actionLabel} queued locally for sync.`,
    details: {
      outboxId: row.id,
      audit,
    },
    time: audit.time,
  });
}

export function buildLocalCreateEvent(
  row: LocalOutboxRow,
  payload: ParsedOutboxPayload
): LifecycleAdminEvent | null {
  if (!isLocalCreateEntityType(row.entityType)) {
    return null;
  }

  const builder = LOCAL_CREATE_EVENT_BUILDERS[row.entityType];
  return builder(row, payload);
}
