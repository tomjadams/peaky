import type {
  PublishResponse,
  TemplateCatalogEntry,
  TemplateLifecycleStatus,
  TemplateRevisionDetail,
  TemplateRevisionDetailResponse,
  TemplatesResponse,
  TemplateRevisionStatus,
} from "~/models";
import type {
  ActorId,
  TeamId,
  TemplateId,
  TemplateRevisionId,
} from "~/models/template";
import type { LifecycleActor } from "~/lifecycle/management";
import { readPersistedActor } from "~/composables/auth/useCurrentActor";
import {
  entitlementService,
  type Entitlement,
  type EntitlementSnapshot,
} from "~/services/entitlement/EntitlementService";
import { safeParse } from "~/local-db";
import { fetchLocalTemplateDraftById } from "~/composables/local/useLocalTemplateDraft";
import { fetchLocalTemplateDrafts } from "~/composables/local/useLocalTemplateDrafts";
import {
  templateWriteUnavailableResult,
  TemplateWriteUnavailableError,
} from "./TemplateRevisionContracts";

export function createEmptyTemplate(): TemplateRevisionDetail {
  const now = new Date().toISOString();
  return {
    id: "",
    templateId: "",
    name: "Untitled Template",
    description: "",
    status: "draft",
    revisionNumber: null,
    revisionSummary: null,
    createdByActorId: "",
    updatedByActorId: "",
    publishedByActorId: null,
    createdAt: now,
    updatedAt: now,
    publishedAt: null,
    pillars: [],
  };
}

function normalizeRevisionDetail(
  revision: TemplateRevisionDetail
): TemplateRevisionDetail {
  return {
    ...revision,
    pillars: revision.pillars.filter(
      (pillar): pillar is TemplateRevisionDetail["pillars"][number] =>
        typeof pillar === "object" && pillar !== null
    ),
    description: revision.description ?? "",
  };
}

function normalizeCatalogEntry(
  entry: TemplateCatalogEntry
): TemplateCatalogEntry {
  return {
    ...entry,
    template: {
      ...entry.template,
      description: entry.template.description ?? "",
    },
    draftRevision: entry.draftRevision ?? null,
    publishedRevisions: entry.publishedRevisions ?? [],
    pillarSlugsByRevisionId: entry.pillarSlugsByRevisionId ?? {},
    reviewsCount: entry.reviewsCount ?? 0,
  };
}

export function canEditTemplateDraftFromSnapshot(
  snapshot: EntitlementSnapshot | null,
  templateId: string,
  now = new Date()
): boolean {
  if (!snapshot) return false;
  if (snapshot.validUntil) {
    const validUntil = new Date(snapshot.validUntil);
    if (Number.isNaN(validUntil.getTime()) || validUntil <= now) return false;
  }
  const entitlements = safeParse<Record<string, Entitlement>>(
    snapshot.entitlements,
    {}
  );
  return entitlementService.canEdit(entitlements, "template", templateId);
}

export function mergeTemplateCatalogEntries(
  remote: TemplateCatalogEntry,
  local: TemplateCatalogEntry
): TemplateCatalogEntry {
  const publishedById = new Map(
    [...remote.publishedRevisions, ...local.publishedRevisions].map(
      (revision) => [revision.id, revision]
    )
  );
  return {
    ...remote,
    template: local.template,
    draftRevision: local.draftRevision ?? remote.draftRevision,
    publishedRevisions: [...publishedById.values()],
    canEditDraft: local.canEditDraft ?? false,
    pillarSlugsByRevisionId: {
      ...remote.pillarSlugsByRevisionId,
      ...local.pillarSlugsByRevisionId,
    },
  };
}

function createDevDemoTemplates(): TemplateCatalogEntry[] {
  const now = new Date().toISOString();
  const actorId = "actor-demo" as ActorId;

  const makeTemplate = (
    id: string,
    name: string,
    description: string,
    status: TemplateLifecycleStatus,
    revisionStatus: TemplateRevisionStatus,
    revisionNumber: number | null,
    reviewsCount: number
  ): TemplateCatalogEntry => {
    const templateId = id as TemplateId;
    const revisionId = `${id}-rev-1` as TemplateRevisionId;
    return {
      template: {
        id: templateId,
        name,
        description,
        status,
        ownerTeamId: "team-demo" as TeamId,
        createdByActorId: actorId,
        updatedByActorId: actorId,
        createdAt: now,
        updatedAt: now,
      },
      draftRevision: null,
      publishedRevisions:
        revisionStatus === "published"
          ? [
              {
                id: revisionId,
                templateId,
                name,
                description,
                status: "published",
                revisionNumber,
                revisionSummary: null,
                publishedAt: now,
              },
            ]
          : [],
      pillarSlugsByRevisionId:
        revisionStatus === "published" ? { [revisionId]: ["general"] } : {},
      reviewsCount,
    };
  };

  return [
    makeTemplate(
      "tpl-soc2",
      "SOC 2 Type II",
      "Security and availability controls for SOC 2 readiness.",
      "active",
      "published",
      1,
      12
    ),
    makeTemplate(
      "tpl-launch",
      "Production Launch Readiness",
      "Checklist before declaring a production service ready.",
      "active",
      "published",
      2,
      5
    ),
    makeTemplate(
      "tpl-oncall",
      "On-call Runbook Maturity",
      "Operational readiness for incident response and on-call rotation.",
      "active",
      "published",
      1,
      3
    ),
    makeTemplate(
      "tpl-migration",
      "Data Migration Plan",
      "Template for planning and reviewing data migrations.",
      "archived",
      "published",
      1,
      0
    ),
  ];
}

export class TemplateCatalog {
  async fetchAuthoringDetail(
    id: string
  ): Promise<TemplateRevisionDetailResponse> {
    const response = await $fetch<TemplateRevisionDetailResponse>(
      `/api/templates/${id}`
    );
    return {
      template: {
        ...response.template,
        description: response.template.description ?? "",
      },
      revision: response.revision
        ? normalizeRevisionDetail(response.revision)
        : null,
    };
  }

  async fetchDetail(id: string): Promise<TemplateRevisionDetail> {
    if (id === "new") return createEmptyTemplate();

    const localRevision = await fetchLocalTemplateDraftById(id);
    if (localRevision) return normalizeRevisionDetail(localRevision);

    const response = await this.fetchAuthoringDetail(id);
    if (!response.revision)
      throw new Error("Published Template Revision not found");
    return response.revision;
  }

  async saveDetail(
    _revision: TemplateRevisionDetail
  ): Promise<TemplateRevisionDetail> {
    throw new TemplateWriteUnavailableError();
  }

  async publish(templateId: string): Promise<PublishResponse> {
    if (!templateId) {
      return { success: false, errors: ["Template must be saved first"] };
    }
    return templateWriteUnavailableResult(
      "Template publication is unavailable"
    );
  }

  async canEditDraft(templateId: string): Promise<boolean> {
    const snapshot = await entitlementService.getSnapshot(
      readPersistedActor().id
    );
    return canEditTemplateDraftFromSnapshot(snapshot, templateId);
  }

  async fetchAll(): Promise<{
    templates: TemplateCatalogEntry[];
    error: Error | null;
  }> {
    let fetchError: Error | null = null;
    const actorId = readPersistedActor().id;
    const [remoteResponse, localTemplates, entitlementSnapshot] =
      await Promise.all([
        $fetch<TemplatesResponse>("/api/templates").catch((cause) => {
          fetchError =
            cause instanceof Error ? cause : new Error(String(cause));
          return { templates: [] } satisfies TemplatesResponse;
        }),
        fetchLocalTemplateDrafts(),
        entitlementService.getSnapshot(actorId),
      ]);
    const merged = new Map<string, TemplateCatalogEntry>();
    for (const entry of remoteResponse.templates) {
      merged.set(entry.template.id, normalizeCatalogEntry(entry));
    }
    for (const entry of localTemplates) {
      const normalized = normalizeCatalogEntry(entry);
      const local = {
        ...normalized,
        canEditDraft:
          normalized.template.status === "active" &&
          normalized.draftRevision !== null &&
          canEditTemplateDraftFromSnapshot(
            entitlementSnapshot,
            normalized.template.id
          ),
      };
      const remote = merged.get(local.template.id);
      merged.set(
        local.template.id,
        remote ? mergeTemplateCatalogEntries(remote, local) : local
      );
    }
    const result = [...merged.values()];
    if (import.meta.dev && result.length === 0) {
      return { templates: createDevDemoTemplates(), error: null };
    }
    return { templates: result, error: fetchError };
  }

  async updateStatus(
    templateId: string,
    _status: TemplateLifecycleStatus,
    _actor: LifecycleActor
  ): Promise<void> {
    if (!templateId) throw new Error("templateId is required");
    throw new TemplateWriteUnavailableError();
  }

  async deleteTemplate(
    templateId: string,
    _confirmationName: string,
    _actor: LifecycleActor
  ): Promise<void> {
    if (!templateId) throw new Error("templateId is required");
    throw new TemplateWriteUnavailableError();
  }
}

export const templateCatalog = new TemplateCatalog();
