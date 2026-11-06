import {
  createAdminEventActor,
  createAdminEventSubject,
  formatAdminEventLabel,
  ReviewAdminEvent,
  LifecycleAdminEvent,
  IntegrationAdminEvent,
  type AdminEventRecord,
} from "~/admin/events";
import { getLifecycleActor } from "../utils/lifecycleActor";
import { getLifecycleAuditEvents } from "../data/lifecycle-audit";
import {
  EVENT_TYPES,
  getAllReviewEvents,
  type ReviewEvent,
  type ReviewEventType,
} from "../data/review-events";
import { findReviewById } from "../data/reviews";
import { findProductReviewById } from "../data/product-reviews";

const REVIEW_LIFECYCLE_EVENT_TYPES = new Set<ReviewEventType>([
  EVENT_TYPES.REVIEW_CREATED,
  EVENT_TYPES.REVIEW_ARCHIVED,
  EVENT_TYPES.REVIEW_RESTORED,
  EVENT_TYPES.REVIEW_DELETED,
  EVENT_TYPES.PUBLISH_COMPLETED,
]);

function getStringValue(
  data: Record<string, unknown>,
  key: string
): string | undefined {
  const value = data[key];
  return typeof value === "string" ? value : undefined;
}

function getNumberValue(data: Record<string, unknown>, key: string): number {
  const value = data[key];
  return typeof value === "number" ? value : 0;
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function resolveReviewSubject(reviewEvent: ReviewEvent) {
  const teamReview = findReviewById(reviewEvent.reviewId);
  if (teamReview) {
    return createAdminEventSubject({
      type: "team-review",
      label: "Team review",
      id: teamReview.id,
      name: teamReview.name,
      url: `/teams/${teamReview.teamId}/reviews/${teamReview.id}`,
    });
  }

  const productReview = findProductReviewById(reviewEvent.reviewId);
  if (productReview) {
    return createAdminEventSubject({
      type: "product-review",
      label: "Product review",
      id: productReview.id,
      name: productReview.name,
      url: `/products/${productReview.productId}/reviews/${productReview.id}`,
    });
  }

  const teamId = getStringValue(reviewEvent.data, "teamId");
  const productId = getStringValue(reviewEvent.data, "productId");
  const reviewName =
    getStringValue(reviewEvent.data, "reviewName") ?? reviewEvent.reviewId;

  return createAdminEventSubject({
    type: teamId ? "team-review" : productId ? "product-review" : "review",
    label: teamId ? "Team review" : productId ? "Product review" : "Review",
    id: reviewEvent.reviewId,
    name: reviewName,
    url: teamId
      ? `/teams/${teamId}/reviews/${reviewEvent.reviewId}`
      : productId
        ? `/products/${productId}/reviews/${reviewEvent.reviewId}`
        : undefined,
  });
}

function buildReviewSummary(event: ReviewEvent, actionLabel: string): string {
  const reviewName = getStringValue(event.data, "reviewName");
  const productName = getStringValue(event.data, "productName");
  const teamName = getStringValue(event.data, "teamName");

  if (event.eventType === EVENT_TYPES.REVIEW_CREATED) {
    const contextName = productName ?? teamName;
    const prefix = reviewName
      ? contextName
        ? `"${reviewName}" for ${contextName}`
        : `"${reviewName}"`
      : contextName
        ? `Review for ${contextName}`
        : "Review";
    return `${prefix} created with ${pluralize(getNumberValue(event.data, "templateCount"), "template")} selected.`;
  }

  if (event.eventType === EVENT_TYPES.CHECKPOINT_SAVED) {
    const note = getStringValue(event.data, "note");
    const base =
      note ??
      `${pluralize(getNumberValue(event.data, "questionsAnswered"), "question")} captured in a checkpoint.`;
    return reviewName ? `${base} (${reviewName})` : base;
  }

  if (event.eventType === EVENT_TYPES.ANSWER_IMPORTED) {
    const count = pluralize(
      getNumberValue(event.data, "importedCount"),
      "answer"
    );
    const source = getStringValue(event.data, "source") ?? "integration";
    return reviewName
      ? `${count} imported from ${source} into "${reviewName}".`
      : `${count} imported from ${source}.`;
  }

  if (event.eventType === EVENT_TYPES.ATTACHMENT_UPLOADED) {
    const filename = getStringValue(event.data, "filename");
    const sizeBytes = getNumberValue(event.data, "sizeBytes");
    const sizeMB =
      sizeBytes > 0 ? ` (${(sizeBytes / 1024 / 1024).toFixed(1)} MB)` : "";
    return filename ? `Uploaded "${filename}"${sizeMB}.` : "File uploaded.";
  }

  if (event.eventType === EVENT_TYPES.ATTACHMENT_DELETED) {
    const filename = getStringValue(event.data, "filename");
    return filename ? `Deleted "${filename}".` : "Attachment deleted.";
  }

  if (event.eventType === EVENT_TYPES.NOTE_RECORDED) {
    const contentLength = getNumberValue(event.data, "contentLength");
    return contentLength > 0
      ? `Note saved (${contentLength} characters).`
      : "Note saved.";
  }

  if (event.eventType === EVENT_TYPES.NOTE_DELETED) {
    return "Note deleted.";
  }

  return actionLabel;
}

function toUserReviewEvents(actorId: string): AdminEventRecord[] {
  return getAllReviewEvents()
    .filter((e) => e.actorId === actorId)
    .map((event) => {
      const actionLabel = formatAdminEventLabel(event.eventType);
      const subject = resolveReviewSubject(event);
      const actor = createAdminEventActor({
        id: event.actorId,
        name: event.actorName ?? event.actorId,
        type: event.actorType,
      });

      const AdminEventClass =
        event.actorType === "integration"
          ? IntegrationAdminEvent
          : REVIEW_LIFECYCLE_EVENT_TYPES.has(event.eventType)
            ? LifecycleAdminEvent
            : ReviewAdminEvent;

      return new AdminEventClass({
        id: event.id,
        action: event.eventType,
        actionLabel,
        subject,
        actor,
        source: "peaky.review-log",
        status: event.status,
        summary: buildReviewSummary(event, actionLabel),
        details: { data: event.data, metadata: event.metadata ?? null },
        time: event.time,
      }).toRecord();
    });
}

function toUserLifecycleEvents(actorId: string): AdminEventRecord[] {
  return getLifecycleAuditEvents()
    .filter((e) => e.actorId === actorId)
    .map((event) => {
      const actionLabel = formatAdminEventLabel(event.action);
      return new LifecycleAdminEvent({
        id: event.id,
        action: event.action,
        actionLabel,
        subject: createAdminEventSubject({
          type: event.subjectType,
          label: formatAdminEventLabel(event.subjectType),
          id: event.subjectId,
          name: event.subjectName,
        }),
        actor: createAdminEventActor({
          id: event.actorId,
          name: event.actorName,
          roles: event.actorRoles,
          type: "user",
        }),
        source: "peaky.api",
        status: "synced",
        summary: `${actionLabel} and opened the resource for future review work.`,
        details: { associatedResources: event.associatedResources },
        time: event.time,
      }).toRecord();
    });
}

export default defineEventHandler(async (event) => {
  const actor = await getLifecycleActor(event);

  const reviewEvents = toUserReviewEvents(actor.id);
  const lifecycleEvents = toUserLifecycleEvents(actor.id);

  return [...lifecycleEvents, ...reviewEvents].toSorted(
    (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
  );
});
