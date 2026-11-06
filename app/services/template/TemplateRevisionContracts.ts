import type {
  ActorId,
  PublishResponse,
  TeamId,
  Template,
  TemplateId,
  TemplateRevision,
  TemplateRevisionId,
  TemplateRevisionStatus,
  TemplateRevisionSummary,
} from "~/models";

export interface TemplateRevisionPublicationState {
  status: TemplateRevisionStatus;
  revisionNumber: number | null;
  publishedAt: string | null;
  publishedByActorId: string | null;
}

export function normalizeRevisionSummary(
  summary: string | null | undefined
): string | null {
  const normalized = summary?.trim() ?? "";
  if (!normalized) return null;
  if (normalized.length > 120) {
    throw new Error("Revision summary must be at most 120 characters");
  }
  return normalized;
}

export function toTemplateRevisionSummary(
  revision: TemplateRevision
): TemplateRevisionSummary {
  return {
    id: revision.id,
    templateId: revision.templateId,
    name: revision.name,
    description: revision.description,
    status: revision.status,
    revisionNumber: revision.revisionNumber,
    revisionSummary: revision.revisionSummary,
    publishedAt: revision.publishedAt,
  };
}

export function assertTemplateRevisionState(
  state: TemplateRevisionPublicationState
): void {
  if (state.status === "draft") {
    if (
      state.revisionNumber !== null ||
      state.publishedAt !== null ||
      state.publishedByActorId !== null
    ) {
      throw new Error("Draft Revision publication metadata must be null");
    }
    return;
  }

  if (
    !Number.isInteger(state.revisionNumber) ||
    (state.revisionNumber ?? 0) <= 0 ||
    !state.publishedAt ||
    !state.publishedByActorId
  ) {
    throw new Error(
      "Published and retired Revision publication metadata must be complete"
    );
  }
}

export interface TemplateProvenance {
  ownerTeamId: string;
  createdByActorId: string;
  updatedByActorId: string;
}

export function assertTemplateProvenance(provenance: TemplateProvenance): void {
  if (
    !provenance.ownerTeamId ||
    !provenance.createdByActorId ||
    !provenance.updatedByActorId
  ) {
    throw new Error("Template ownership and actor provenance are required");
  }
}

export function assertOwnerTeamUnchanged(
  currentOwnerTeamId: string,
  nextOwnerTeamId: string
): void {
  if (currentOwnerTeamId !== nextOwnerTeamId) {
    throw new Error("Template owner Team is immutable");
  }
}

export function assertDraftRevisionMutable(
  status: TemplateRevisionStatus
): void {
  if (status !== "draft") {
    throw new Error(`${status} Template Revision is immutable`);
  }
}

export interface InitializeTemplateInput {
  id: TemplateId;
  name: string;
  description: string;
  ownerTeamId: TeamId;
  actorId: ActorId;
  now: string;
}

export interface InitializeDraftRevisionInput {
  id: TemplateRevisionId;
  templateId: TemplateId;
  name: string;
  description: string;
  actorId: ActorId;
  now: string;
  revisionSummary?: string | null;
}

function assertRequired(value: string, field: string): void {
  if (!value) throw new Error(`${field} is required`);
}

export function initializeTemplate(input: InitializeTemplateInput): Template {
  assertRequired(input.id, "Template identity");
  assertRequired(input.ownerTeamId, "Template owner Team");
  assertRequired(input.actorId, "Template actor");
  assertRequired(input.now, "Template timestamp");
  return {
    id: input.id,
    name: input.name,
    description: input.description,
    status: "active",
    ownerTeamId: input.ownerTeamId,
    createdByActorId: input.actorId,
    updatedByActorId: input.actorId,
    createdAt: input.now,
    updatedAt: input.now,
  };
}

export function initializeDraftRevision(
  input: InitializeDraftRevisionInput
): TemplateRevision {
  assertRequired(input.id, "Template Revision identity");
  assertRequired(input.templateId, "Template identity");
  assertRequired(input.actorId, "Template Revision actor");
  assertRequired(input.now, "Template Revision timestamp");
  return {
    id: input.id,
    templateId: input.templateId,
    name: input.name,
    description: input.description,
    status: "draft",
    revisionNumber: null,
    revisionSummary: normalizeRevisionSummary(input.revisionSummary),
    createdByActorId: input.actorId,
    updatedByActorId: input.actorId,
    publishedByActorId: null,
    createdAt: input.now,
    updatedAt: input.now,
    publishedAt: null,
  };
}

export function updateTemplateMetadata(
  template: Template,
  updates: Partial<Pick<Template, "name" | "description" | "ownerTeamId">>,
  actorId: ActorId,
  now: string
): Template {
  assertRequired(actorId, "Template updater");
  assertRequired(now, "Template update timestamp");
  if (updates.ownerTeamId !== undefined) {
    assertOwnerTeamUnchanged(template.ownerTeamId, updates.ownerTeamId);
  }
  return {
    ...template,
    name: updates.name ?? template.name,
    description: updates.description ?? template.description,
    updatedByActorId: actorId,
    updatedAt: now,
  };
}

export function updateDraftRevisionMetadata(
  revision: TemplateRevision,
  updates: Partial<
    Pick<TemplateRevision, "name" | "description" | "revisionSummary">
  >,
  actorId: ActorId,
  now: string
): TemplateRevision {
  assertDraftRevisionMutable(revision.status);
  assertRequired(actorId, "Template Revision updater");
  assertRequired(now, "Template Revision update timestamp");
  return {
    ...revision,
    name: updates.name ?? revision.name,
    description: updates.description ?? revision.description,
    revisionSummary:
      updates.revisionSummary !== undefined
        ? normalizeRevisionSummary(updates.revisionSummary)
        : revision.revisionSummary,
    updatedByActorId: actorId,
    updatedAt: now,
  };
}

export const TEMPLATE_WRITE_UNAVAILABLE_CODE =
  "template_write_unavailable" as const;
export const TEMPLATE_WRITE_UNAVAILABLE_MESSAGE = "Template write unavailable";

export function templateWriteUnavailableResult(
  error = TEMPLATE_WRITE_UNAVAILABLE_MESSAGE
): PublishResponse {
  return {
    success: false,
    code: TEMPLATE_WRITE_UNAVAILABLE_CODE,
    errors: [error],
  };
}

export class TemplateWriteUnavailableError extends Error {
  readonly code = TEMPLATE_WRITE_UNAVAILABLE_CODE;

  constructor() {
    super(TEMPLATE_WRITE_UNAVAILABLE_MESSAGE);
    this.name = "TemplateWriteUnavailableError";
  }
}
