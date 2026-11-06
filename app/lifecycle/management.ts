import type { AppActor } from "~/admin/events";
import type { Product } from "~/models";
import { assertNever } from "#shared/exhaustive";

export type LifecycleRole = "admin" | "member";
export const VALID_LIFECYCLE_ROLES: ReadonlySet<LifecycleRole> = new Set([
  "admin",
  "member",
]);
export type LifecycleAction = "create" | "archive" | "restore" | "delete";
export type LifecycleSubjectType = "product" | "template";

export interface LifecycleActor extends AppActor {
  roles: LifecycleRole[];
}

export interface LifecycleAssociatedResources {
  reviewsCount?: number;
  activeReviewCount?: number;
}

export interface LifecycleAuditRecord {
  action: LifecycleAction;
  subjectType: LifecycleSubjectType;
  subjectId: string;
  subjectName: string;
  actorId: string;
  actorName: string;
  actorRoles: LifecycleRole[];
  source: "peaky.api" | "peaky.client";
  associatedResources: LifecycleAssociatedResources;
  time: string;
}

export const DEFAULT_LIFECYCLE_ACTOR: LifecycleActor = {
  id: "heitorl",
  name: "Heitor Lessa",
  roles: ["admin"],
};

export function getDefaultLifecycleActor(): LifecycleActor {
  return {
    ...DEFAULT_LIFECYCLE_ACTOR,
    roles: [...DEFAULT_LIFECYCLE_ACTOR.roles],
  };
}

function normalizeAssociatedResources(
  resources?: LifecycleAssociatedResources
): LifecycleAssociatedResources {
  return {
    reviewsCount: resources?.reviewsCount ?? 0,
    activeReviewCount: resources?.activeReviewCount ?? 0,
  };
}

export function buildLifecycleActorHeaders(
  actor: LifecycleActor = DEFAULT_LIFECYCLE_ACTOR
): Record<string, string> {
  return {
    "x-actor-id": actor.id,
    "x-actor-name": actor.name,
    "x-actor-roles": actor.roles.join(","),
  };
}

export function isLifecycleAdmin(actor: LifecycleActor): boolean {
  return actor.roles.includes("admin");
}

export function canManageProductLifecycle(
  actor: LifecycleActor,
  product: Pick<Product, "productManagerId" | "engineeringLeadId">
): boolean {
  return (
    isLifecycleAdmin(actor) ||
    actor.id === product.productManagerId ||
    actor.id === product.engineeringLeadId
  );
}

export function canManageTemplateLifecycle(_actor: LifecycleActor): boolean {
  return false;
}

export function matchesLifecycleConfirmation(
  expectedName: string,
  providedName?: string | null
): boolean {
  return expectedName.trim() === (providedName?.trim() ?? "");
}

export function assertLifecycleConfirmation(
  expectedName: string,
  providedName?: string | null,
  subjectType: LifecycleSubjectType = "product"
): void {
  if (matchesLifecycleConfirmation(expectedName, providedName)) {
    return;
  }

  throw new Error(
    `Type the ${subjectType} name exactly to confirm permanent delete`
  );
}

export function createLifecycleAuditRecord(input: {
  action: LifecycleAction;
  subjectType: LifecycleSubjectType;
  subjectId: string;
  subjectName: string;
  actor: LifecycleActor;
  source: "peaky.api" | "peaky.client";
  associatedResources?: LifecycleAssociatedResources;
}): LifecycleAuditRecord {
  return {
    action: input.action,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    subjectName: input.subjectName,
    actorId: input.actor.id,
    actorName: input.actor.name,
    actorRoles: [...input.actor.roles],
    source: input.source,
    associatedResources: normalizeAssociatedResources(
      input.associatedResources
    ),
    time: new Date().toISOString(),
  };
}

export function getLifecycleSubjectUrl(
  subjectType: LifecycleSubjectType,
  subjectId: string
): string {
  switch (subjectType) {
    case "product":
      return `/products/${subjectId}`;
    case "template":
      return `/templates/${subjectId}/edit`;
    default:
      return assertNever(subjectType, "Unsupported lifecycle subject type");
  }
}
