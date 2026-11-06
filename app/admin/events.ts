export const ADMIN_EVENT_CATEGORIES = [
  "product",
  "template",
  "system",
  "lifecycle",
  "review",
  "integration",
] as const;
export const ADMIN_EVENT_STATUSES = [
  "synced",
  "pending",
  "failed",
  "local",
] as const;
export const ADMIN_EVENT_SOURCES = [
  "peaky.client",
  "peaky.api",
  "peaky.sync",
  "peaky.review-log",
] as const;
export const ADMIN_EVENT_ACTOR_TYPES = [
  "user",
  "integration",
  "system",
] as const;

export type AdminEventCategory = (typeof ADMIN_EVENT_CATEGORIES)[number];
export type AdminEventStatus = (typeof ADMIN_EVENT_STATUSES)[number];
export type AdminEventSource = (typeof ADMIN_EVENT_SOURCES)[number];
export type AdminEventActorType = (typeof ADMIN_EVENT_ACTOR_TYPES)[number];

export interface AppActor {
  id: string;
  name: string;
}

export interface AdminEventActor extends AppActor {
  roles?: readonly string[];
  type?: AdminEventActorType;
}

export interface AdminEventSubject {
  type: string;
  label: string;
  id: string;
  name: string;
  url?: string;
}

export interface AdminEventRecord {
  id: string;
  category: AdminEventCategory;
  action: string;
  actionLabel: string;
  subjectType: string;
  subjectTypeLabel: string;
  subjectId: string;
  subjectName: string;
  subjectUrl?: string;
  actorId: string;
  actorName: string;
  actorRoles: string[];
  actorType: AdminEventActorType;
  source: AdminEventSource;
  status: AdminEventStatus;
  summary: string;
  details: Record<string, unknown>;
  time: string;
  /** Set when a GDPR right-to-erasure request has been applied to this event. */
  piiRedactedAt?: string;
}

interface AdminEventConfig {
  id: string;
  action: string;
  actionLabel: string;
  subject: AdminEventSubject;
  actor: AdminEventActor;
  source: AdminEventSource;
  status: AdminEventStatus;
  summary?: string;
  details?: Record<string, unknown>;
  time: string;
  piiRedactedAt?: string;
}

export const CURRENT_USER_ADMIN_ACTOR_ID = "current-user";

// Words that should render fully uppercased after the camelCase split. Without
// this list "LocalDbInitializing.v1" would render as "Local Db Initializing"
// instead of the human-correct "Local DB Initializing".
const ACRONYMS = new Set(["db", "opfs", "url", "api", "json", "http", "id"]);

export function formatAdminEventLabel(value: string): string {
  // Strip version suffix (e.g., ".v1") for display
  const base = value.replace(/\.v\d+$/, "");
  // Insert spaces at PascalCase boundaries, then split on every word boundary
  // (delimiters AND whitespace) so the acronym pass sees individual words.
  return base
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(/[\s._-]+/g)
    .filter(Boolean)
    .map((part) => {
      if (ACRONYMS.has(part.toLowerCase())) return part.toUpperCase();
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

export function createAdminEventActor(
  actor: AdminEventActor
): Required<AdminEventActor> {
  return {
    id: actor.id,
    name: actor.name,
    roles: [...(actor.roles ?? [])],
    type: actor.type ?? "user",
  };
}

export function createAdminEventSubject(
  subject: AdminEventSubject
): AdminEventSubject {
  return {
    ...subject,
  };
}

abstract class BaseAdminEvent {
  constructor(private readonly config: AdminEventConfig) {}

  protected abstract readonly category: AdminEventCategory;

  protected get summary(): string {
    return this.config.summary ?? this.config.actionLabel;
  }

  protected get details(): Record<string, unknown> {
    return this.config.details ?? {};
  }

  toRecord(): AdminEventRecord {
    const actor = createAdminEventActor(this.config.actor);
    const subject = createAdminEventSubject(this.config.subject);

    return {
      id: this.config.id,
      category: this.category,
      action: this.config.action,
      actionLabel: this.config.actionLabel,
      subjectType: subject.type,
      subjectTypeLabel: subject.label,
      subjectId: subject.id,
      subjectName: subject.name,
      subjectUrl: subject.url,
      actorId: actor.id,
      actorName: actor.name,
      actorRoles: [...actor.roles],
      actorType: actor.type,
      source: this.config.source,
      status: this.config.status,
      summary: this.summary,
      details: this.details,
      time: this.config.time,
      piiRedactedAt: this.config.piiRedactedAt,
    };
  }
}

export class ProductAdminEvent extends BaseAdminEvent {
  protected readonly category = "product" as const;
}

export class TemplateAdminEvent extends BaseAdminEvent {
  protected readonly category = "template" as const;
}

export class SystemAdminEvent extends BaseAdminEvent {
  protected readonly category = "system" as const;
}

export class LifecycleAdminEvent extends BaseAdminEvent {
  protected readonly category = "lifecycle" as const;
}

export class ReviewAdminEvent extends BaseAdminEvent {
  protected readonly category = "review" as const;
}

export class IntegrationAdminEvent extends BaseAdminEvent {
  protected readonly category = "integration" as const;
}
