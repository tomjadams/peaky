import {
  createAdminEventActor,
  createAdminEventSubject,
  formatAdminEventLabel,
  IntegrationAdminEvent,
  LifecycleAdminEvent,
  ProductAdminEvent,
  ReviewAdminEvent,
  TemplateAdminEvent,
  type AdminEventRecord,
} from "~/admin/events";
import { getLifecycleSubjectUrl } from "~/lifecycle/management";
import { getLifecycleAuditEvents } from "./lifecycle-audit";
import {
  EVENT_TYPES,
  getAllReviewEvents,
  type ReviewEvent,
  type ReviewEventType,
} from "./review-events";
import { findReviewById } from "./reviews";
import { findProductReviewById } from "./product-reviews";

const REVIEW_LIFECYCLE_EVENT_TYPES = new Set<ReviewEventType>([
  EVENT_TYPES.REVIEW_CREATED,
  EVENT_TYPES.REVIEW_ARCHIVED,
  EVENT_TYPES.REVIEW_RESTORED,
  EVENT_TYPES.REVIEW_DELETED,
  EVENT_TYPES.PUBLISH_COMPLETED,
]);

function pluralize(
  count: number,
  singular: string,
  plural = `${singular}s`
): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function getNumberValue(data: Record<string, unknown>, key: string): number {
  const value = data[key];
  return typeof value === "number" ? value : 0;
}

function getStringValue(
  data: Record<string, unknown>,
  key: string
): string | undefined {
  const value = data[key];
  return typeof value === "string" ? value : undefined;
}

function buildLifecycleSummary(input: {
  action: AdminEventRecord["action"];
  actionLabel: string;
  reviewsCount?: number;
  activeReviewCount?: number;
}): string {
  const reviewsCount = input.reviewsCount ?? 0;
  const activeReviewCount = input.activeReviewCount ?? 0;

  if (input.action === "create") {
    return `${input.actionLabel} and opened the resource for future review work.`;
  }

  if (reviewsCount === 0) {
    return `${input.actionLabel} with no linked reviews.`;
  }

  return `${input.actionLabel} with ${pluralize(reviewsCount, "linked review")} (${pluralize(activeReviewCount, "active")}).`;
}

function createReviewSubjectFromLookup(reviewEvent: ReviewEvent) {
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

  return null;
}

function getReviewSubject(
  reviewEvent: ReviewEvent
): Pick<
  AdminEventRecord,
  | "subjectType"
  | "subjectTypeLabel"
  | "subjectId"
  | "subjectName"
  | "subjectUrl"
> {
  const resolvedSubject = createReviewSubjectFromLookup(reviewEvent);

  if (resolvedSubject) {
    return {
      subjectType: resolvedSubject.type,
      subjectTypeLabel: resolvedSubject.label,
      subjectId: resolvedSubject.id,
      subjectName: resolvedSubject.name,
      subjectUrl: resolvedSubject.url,
    };
  }

  const teamId = getStringValue(reviewEvent.data, "teamId");
  const productId = getStringValue(reviewEvent.data, "productId");
  const productName = getStringValue(reviewEvent.data, "productName");

  return {
    subjectType: teamId
      ? "team-review"
      : productId
        ? "product-review"
        : "review",
    subjectTypeLabel: teamId
      ? "Team review"
      : productId
        ? "Product review"
        : "Review",
    subjectId: reviewEvent.reviewId,
    subjectName: productName
      ? `Review for ${productName}`
      : reviewEvent.reviewId,
    subjectUrl: teamId
      ? `/teams/${teamId}/reviews/${reviewEvent.reviewId}`
      : productId
        ? `/products/${productId}/reviews/${reviewEvent.reviewId}`
        : undefined,
  };
}

function createAdminSubjectFromReviewEvent(reviewEvent: ReviewEvent) {
  const subject = getReviewSubject(reviewEvent);

  return createAdminEventSubject({
    type: subject.subjectType,
    label: subject.subjectTypeLabel,
    id: subject.subjectId,
    name: subject.subjectName,
    url: subject.subjectUrl,
  });
}

function createAdminActorFromReviewEvent(reviewEvent: ReviewEvent) {
  return createAdminEventActor({
    id: reviewEvent.actorId,
    name: reviewEvent.actorName ?? reviewEvent.actorId,
    type: reviewEvent.actorType,
  });
}

function createReviewEventDetails(reviewEvent: ReviewEvent) {
  return {
    data: reviewEvent.data,
    metadata: reviewEvent.metadata ?? null,
  };
}

function createLifecycleSubject(event: {
  action: string;
  subjectId: string;
  subjectName: string;
  subjectType: "product" | "template";
}) {
  return createAdminEventSubject({
    type: event.subjectType,
    label: formatAdminEventLabel(event.subjectType),
    id: event.subjectId,
    name: event.subjectName,
    url:
      event.action === "delete"
        ? undefined
        : getLifecycleSubjectUrl(event.subjectType, event.subjectId),
  });
}

const REVIEW_SUMMARY_BUILDERS = {
  [EVENT_TYPES.REVIEW_CREATED]: (event: ReviewEvent) => {
    const reviewName = getStringValue(event.data, "reviewName");
    const productName = getStringValue(event.data, "productName");
    const teamName = getStringValue(event.data, "teamName");
    const contextName = productName ?? teamName;
    const prefix = reviewName
      ? contextName
        ? `"${reviewName}" for ${contextName}`
        : `"${reviewName}"`
      : contextName
        ? `Review for ${contextName}`
        : "Review";
    return `${prefix} created with ${pluralize(getNumberValue(event.data, "templateCount"), "template")} selected.`;
  },
  [EVENT_TYPES.REVIEW_ARCHIVED]: (event: ReviewEvent) => {
    const reviewName = getStringValue(event.data, "reviewName");
    const prefix = reviewName ? `"${reviewName}"` : "Review";
    return `${prefix} archived with ${pluralize(getNumberValue(event.data, "templateCount"), "template")} and ${pluralize(getNumberValue(event.data, "applicationCount"), "application")} attached.`;
  },
  [EVENT_TYPES.REVIEW_RESTORED]: (event: ReviewEvent) => {
    const reviewName = getStringValue(event.data, "reviewName");
    const prefix = reviewName ? `"${reviewName}"` : "Review";
    return `${prefix} restored with ${pluralize(getNumberValue(event.data, "templateCount"), "template")} and ${pluralize(getNumberValue(event.data, "applicationCount"), "application")} attached.`;
  },
  [EVENT_TYPES.REVIEW_DELETED]: (event: ReviewEvent) => {
    const reviewName = getStringValue(event.data, "reviewName");
    const prefix = reviewName ? `"${reviewName}"` : "Review";
    return `${prefix} permanently deleted with ${pluralize(getNumberValue(event.data, "templateCount"), "template")} and ${pluralize(getNumberValue(event.data, "applicationCount"), "application")} attached.`;
  },
  [EVENT_TYPES.CHECKPOINT_SAVED]: (event: ReviewEvent) => {
    const note = getStringValue(event.data, "note");
    const reviewName = getStringValue(event.data, "reviewName");
    const base =
      note ??
      `${pluralize(getNumberValue(event.data, "questionsAnswered"), "question")} captured in a checkpoint.`;
    return reviewName ? `${base} (${reviewName})` : base;
  },
  [EVENT_TYPES.ANSWER_IMPORTED]: (event: ReviewEvent) => {
    const reviewName = getStringValue(event.data, "reviewName");
    const count = pluralize(
      getNumberValue(event.data, "importedCount"),
      "answer"
    );
    const source = getStringValue(event.data, "source") ?? "integration";
    return reviewName
      ? `${count} imported from ${source} into "${reviewName}".`
      : `${count} imported from ${source}.`;
  },
  [EVENT_TYPES.ATTACHMENT_UPLOADED]: (event: ReviewEvent) => {
    const filename = getStringValue(event.data, "filename");
    const sizeBytes = getNumberValue(event.data, "sizeBytes");
    const sizeMB =
      sizeBytes > 0 ? ` (${(sizeBytes / 1024 / 1024).toFixed(1)} MB)` : "";
    return filename ? `Uploaded "${filename}"${sizeMB}.` : "File uploaded.";
  },
  [EVENT_TYPES.ATTACHMENT_DELETED]: (event: ReviewEvent) => {
    const filename = getStringValue(event.data, "filename");
    return filename ? `Deleted "${filename}".` : "Attachment deleted.";
  },
  [EVENT_TYPES.NOTE_RECORDED]: (event: ReviewEvent) => {
    const contentLength = getNumberValue(event.data, "contentLength");
    return contentLength > 0
      ? `Note saved (${contentLength} characters).`
      : "Note saved.";
  },
  [EVENT_TYPES.NOTE_DELETED]: (_event: ReviewEvent) => "Note deleted.",
} satisfies Partial<
  Record<ReviewEventType, (event: ReviewEvent, actionLabel: string) => string>
>;

function getReviewSummaryBuilder(eventType: ReviewEventType) {
  return REVIEW_SUMMARY_BUILDERS[
    eventType as keyof typeof REVIEW_SUMMARY_BUILDERS
  ];
}

function buildReviewSummary(
  reviewEvent: ReviewEvent,
  actionLabel: string
): string {
  const buildSummary = getReviewSummaryBuilder(reviewEvent.eventType);
  return buildSummary?.(reviewEvent) ?? actionLabel;
}

function toLifecycleAdminEvents(): AdminEventRecord[] {
  return getLifecycleAuditEvents().map((event) => {
    const actionLabel = formatAdminEventLabel(event.action);

    const EventClass =
      event.subjectType === "product" ? ProductAdminEvent : TemplateAdminEvent;

    return new EventClass({
      id: event.id,
      action: event.action,
      actionLabel,
      subject: createLifecycleSubject(event),
      actor: createAdminEventActor({
        id: event.actorId,
        name: event.actorName,
        roles: event.actorRoles,
        type: "user",
      }),
      source: "peaky.api",
      status: "synced",
      summary: buildLifecycleSummary({
        action: event.action,
        actionLabel,
        reviewsCount: event.associatedResources.reviewsCount,
        activeReviewCount: event.associatedResources.activeReviewCount,
      }),
      details: {
        associatedResources: event.associatedResources,
      },
      time: event.time,
    }).toRecord();
  });
}

function toReviewAdminEvents(): AdminEventRecord[] {
  return getAllReviewEvents().map((event) => {
    const actionLabel = formatAdminEventLabel(event.eventType);
    const sharedConfig = {
      id: event.id,
      action: event.eventType,
      actionLabel,
      subject: createAdminSubjectFromReviewEvent(event),
      actor: createAdminActorFromReviewEvent(event),
      source: "peaky.review-log" as const,
      status: event.status,
      summary: buildReviewSummary(event, actionLabel),
      details: createReviewEventDetails(event),
      time: event.time,
      piiRedactedAt: event.piiRedactedAt,
    };

    const adminEvent =
      event.actorType === "integration"
        ? new IntegrationAdminEvent(sharedConfig)
        : REVIEW_LIFECYCLE_EVENT_TYPES.has(event.eventType)
          ? new LifecycleAdminEvent(sharedConfig)
          : new ReviewAdminEvent(sharedConfig);

    return adminEvent.toRecord();
  });
}

export function listAdminEvents(): AdminEventRecord[] {
  return [...toLifecycleAdminEvents(), ...toReviewAdminEvents()].toSorted(
    (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
  );
}
