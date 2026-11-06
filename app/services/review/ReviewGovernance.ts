/**
 * Authorization predicates for review operations.
 *
 * Stateless pure functions — no DB access, no Vue.
 */

import type { AppActor } from "~/admin/events";
import type { ReviewParticipant } from "~/models";
import type { LifecycleRole } from "~/lifecycle/management";

export interface ReviewActor extends AppActor {
  roles?: LifecycleRole[];
}

export const REVIEW_ADMIN_IDS = new Set(["admin-001"]);

export const DEFAULT_REVIEW_ACTOR: ReviewActor = {
  id: "admin-001",
  name: "Avery Admin",
  roles: ["admin"],
};

export function getDefaultReviewActor(): ReviewActor {
  return { ...DEFAULT_REVIEW_ACTOR };
}

export function normalizeReviewActor(
  actor?: Partial<ReviewActor> | null
): ReviewActor {
  if (!actor?.id) {
    return getDefaultReviewActor();
  }

  return {
    id: actor.id,
    name: actor.name?.trim() || actor.id,
    roles: actor.roles?.length ? [...actor.roles] : undefined,
  };
}

export function isReviewAdmin(
  actor: string | Pick<ReviewActor, "id" | "roles">
): boolean {
  if (typeof actor === "string") {
    return REVIEW_ADMIN_IDS.has(actor);
  }

  return actor.roles?.includes("admin") ?? REVIEW_ADMIN_IDS.has(actor.id);
}

export function isReviewParticipantOwner(
  actorId: string,
  participants: ReviewParticipant[]
): boolean {
  return participants.some((participant) => participant.id === actorId);
}
