import type {
  LifecycleAction,
  LifecycleActor,
  LifecycleAssociatedResources,
  LifecycleSubjectType,
} from "../../app/lifecycle/management";
import { notifyAdminEventsUpdated } from "./admin-events-stream";

export interface LifecycleAuditEvent {
  id: string;
  action: LifecycleAction;
  subjectType: LifecycleSubjectType;
  subjectId: string;
  subjectName: string;
  actorId: string;
  actorName: string;
  actorRoles: string[];
  source: "peaky.api";
  associatedResources: LifecycleAssociatedResources;
  time: string;
}

const lifecycleAuditEvents: LifecycleAuditEvent[] = [];
let lifecycleAuditCounter = 0;

export function recordLifecycleAuditEvent(input: {
  action: LifecycleAction;
  subjectType: LifecycleSubjectType;
  subjectId: string;
  subjectName: string;
  actor: LifecycleActor;
  associatedResources?: LifecycleAssociatedResources;
}): LifecycleAuditEvent {
  lifecycleAuditCounter += 1;

  const event: LifecycleAuditEvent = {
    id: `lifecycle-audit-${String(lifecycleAuditCounter).padStart(3, "0")}`,
    action: input.action,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    subjectName: input.subjectName,
    actorId: input.actor.id,
    actorName: input.actor.name,
    actorRoles: [...input.actor.roles],
    source: "peaky.api",
    associatedResources: {
      reviewsCount: input.associatedResources?.reviewsCount ?? 0,
      activeReviewCount: input.associatedResources?.activeReviewCount ?? 0,
    },
    time: new Date().toISOString(),
  };

  lifecycleAuditEvents.push(event);
  notifyAdminEventsUpdated();
  return event;
}

export function getLifecycleAuditEvents(): LifecycleAuditEvent[] {
  return [...lifecycleAuditEvents];
}

export function clearLifecycleAuditEvents(): void {
  lifecycleAuditEvents.length = 0;
  lifecycleAuditCounter = 0;
}
