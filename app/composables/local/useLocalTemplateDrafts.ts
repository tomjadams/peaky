/**
 * Local-first Template drafts list composable.
 *
 * Provides reactive access to local Templates that have a draft Revision.
 *
 * @see site/docs/development/walkthroughs/local-first-data-model-api.md
 */

import { computed, ref } from "vue";
import { eq } from "drizzle-orm";
import { withDatabase, desc } from "~/local-db";
import {
  templatePillars,
  templateRevisions,
  templates,
} from "#shared/db/schema";
import type { TemplateCatalogEntry } from "~/models";
import { toTemplateRevisionSummary } from "~/services/template/TemplateRevisionContracts";

type TemplateRow = typeof templates.$inferSelect;
type RevisionRow = typeof templateRevisions.$inferSelect;

export function toTemplateSummary(
  template: TemplateRow,
  revision: RevisionRow,
  pillarSlugsByRevisionId: ReadonlyMap<string, string[]>
): TemplateCatalogEntry {
  return {
    template: {
      id: template.id,
      name: template.name,
      description: template.description,
      status: template.status,
      ownerTeamId: template.ownerTeamId,
      createdByActorId: template.createdByActorId,
      updatedByActorId: template.updatedByActorId,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    },
    draftRevision: toTemplateRevisionSummary(revision),
    publishedRevisions: [],
    pillarSlugsByRevisionId: {
      [revision.id]: pillarSlugsByRevisionId.get(revision.id) ?? [],
    },
    reviewsCount: 0,
  };
}

export async function fetchLocalTemplateDrafts(): Promise<
  TemplateCatalogEntry[]
> {
  return withDatabase(async (db) => {
    const [drafts, templateRows, pillars] = await Promise.all([
      db
        .select()
        .from(templateRevisions)
        .where(eq(templateRevisions.status, "draft"))
        .orderBy(desc(templateRevisions.updatedAt)),
      db.select().from(templates),
      db
        .select({
          revisionId: templatePillars.templateRevisionId,
          slug: templatePillars.slug,
        })
        .from(templatePillars)
        .orderBy(templatePillars.orderKey),
    ]);
    const templatesById = new Map(templateRows.map((row) => [row.id, row]));
    const pillarSlugsByRevisionId = new Map<string, string[]>();

    for (const pillar of pillars) {
      const slugs = pillarSlugsByRevisionId.get(pillar.revisionId) ?? [];
      slugs.push(pillar.slug);
      pillarSlugsByRevisionId.set(pillar.revisionId, slugs);
    }

    return drafts.flatMap((revision) => {
      const template = templatesById.get(revision.templateId);
      return template
        ? [toTemplateSummary(template, revision, pillarSlugsByRevisionId)]
        : [];
    });
  });
}

export function useLocalTemplateDrafts() {
  const data = ref<TemplateCatalogEntry[]>([]);
  const error = ref<Error | null>(null);
  const isLoading = ref(false);

  async function refresh(): Promise<void> {
    isLoading.value = true;
    error.value = null;
    try {
      data.value = await fetchLocalTemplateDrafts();
    } catch (cause) {
      error.value = cause instanceof Error ? cause : new Error(String(cause));
    } finally {
      isLoading.value = false;
    }
  }

  refresh();

  const drafts = computed(() => data.value);

  return { drafts, error, isLoading, refresh };
}
