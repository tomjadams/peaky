import type {
  AdminEventActorType,
  AdminEventCategory,
  AdminEventRecord,
  AdminEventSource,
  AdminEventStatus,
} from "~/admin/events";

type BadgeColor = "error" | "primary" | "secondary" | "neutral";
type EventSortKey =
  | "time"
  | "actionLabel"
  | "subjectName"
  | "actorName"
  | "status";
type EventSortDirection = "asc" | "desc";

const CATEGORY_LABELS = {
  integration: "Integration",
  lifecycle: "Lifecycle",
  product: "Product",
  review: "Review",
  system: "System",
  template: "Template",
} satisfies Record<AdminEventCategory, string>;

const SOURCE_LABELS = {
  "peaky.client": "Client",
  "peaky.api": "API",
  "peaky.sync": "Sync",
  "peaky.review-log": "Review log",
} satisfies Record<AdminEventSource, string>;

const CATEGORY_COLORS = {
  integration: "secondary",
  lifecycle: "primary",
  product: "primary",
  review: "neutral",
  system: "secondary",
  template: "neutral",
} satisfies Record<AdminEventCategory, BadgeColor>;

const ACTOR_TYPE_COLORS = {
  integration: "secondary",
  system: "primary",
  user: "neutral",
} satisfies Record<AdminEventActorType, BadgeColor>;

const STATUS_COLORS = {
  failed: "error",
  pending: "primary",
  synced: "secondary",
  // Events flagged `local: true` in the catalog stay on the device and never
  // become eligible for push. Render with neutral chrome to differentiate from
  // sync-eligible states without implying success or pending work.
  local: "neutral",
} satisfies Record<AdminEventStatus, BadgeColor>;

const EVENT_SORT_ACCESSORS = {
  actionLabel: (event: AdminEventRecord) => event.actionLabel.toLowerCase(),
  actorName: (event: AdminEventRecord) => event.actorName.toLowerCase(),
  time: (event: AdminEventRecord) => new Date(event.time).getTime(),
  status: (event: AdminEventRecord) => event.status,
  subjectName: (event: AdminEventRecord) => event.subjectName.toLowerCase(),
} satisfies Record<EventSortKey, (event: AdminEventRecord) => number | string>;

export function formatEventTime(value: string): string {
  const timestamp = new Date(value).getTime();

  if (Number.isNaN(timestamp)) {
    return "—";
  }

  const deltaMs = Date.now() - timestamp;
  const deltaMinutes = Math.floor(deltaMs / (1000 * 60));

  if (deltaMinutes < 1) {
    return "just now";
  }

  if (deltaMinutes < 60) {
    return `${deltaMinutes}m ago`;
  }

  const deltaHours = Math.floor(deltaMinutes / 60);
  if (deltaHours < 24) {
    return `${deltaHours}h ago`;
  }

  const deltaDays = Math.floor(deltaHours / 24);
  if (deltaDays < 30) {
    return `${deltaDays}d ago`;
  }

  const deltaMonths = Math.floor(deltaDays / 30);
  if (deltaMonths < 12) {
    return `${deltaMonths}mo ago`;
  }

  const deltaYears = Math.floor(deltaDays / 365);
  return `${deltaYears}y ago`;
}

export function formatEventTimeFull(value: string): string {
  const timestamp = new Date(value);

  return Number.isNaN(timestamp.getTime()) ? "—" : timestamp.toLocaleString();
}

export function formatCategoryLabel(category: AdminEventCategory): string {
  return CATEGORY_LABELS[category];
}

export function formatSourceLabel(source: AdminEventSource): string {
  return SOURCE_LABELS[source];
}

export function getCategoryColor(category: AdminEventCategory): BadgeColor {
  return CATEGORY_COLORS[category];
}

export function getActorTypeColor(actorType: AdminEventActorType): BadgeColor {
  return ACTOR_TYPE_COLORS[actorType];
}

export function getStatusColor(status: AdminEventStatus): BadgeColor {
  return STATUS_COLORS[status];
}

export function compareAdminEvents(
  left: AdminEventRecord,
  right: AdminEventRecord,
  column: EventSortKey,
  direction: EventSortDirection
): number {
  const compareLeft = EVENT_SORT_ACCESSORS[column](left);
  const compareRight = EVENT_SORT_ACCESSORS[column](right);

  if (compareLeft < compareRight) {
    return direction === "asc" ? -1 : 1;
  }

  if (compareLeft > compareRight) {
    return direction === "asc" ? 1 : -1;
  }

  return 0;
}

export function matchesAdminEventQuery(
  event: AdminEventRecord,
  query: string
): boolean {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  return [
    event.actionLabel,
    event.summary,
    event.subjectName,
    event.subjectId,
    event.actorName,
    event.actorId,
  ].some((value) => value.toLowerCase().includes(normalizedQuery));
}
