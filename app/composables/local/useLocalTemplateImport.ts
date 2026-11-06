/**
 * Local-first template draft import/export operations.
 *
 * Provides functions to import templates from markdown and export to markdown.
 *
 * @see site/docs/development/walkthroughs/local-first-data-model-api.md
 */

import {
  withDatabase,
  safeParse,
  firstOrNull,
  createUuidV7,
  eq,
  desc,
} from "~/local-db";
import { templatePillars, templateRevisionImports } from "#shared/db/schema";
import { localMutation } from "~/services/local-mutation";
import { requireMutableRevision } from "./templateRevisionWrite";
import type { TemplateRevisionDetail } from "~/models/template";
import { addLocalPillar, updateLocalPillar } from "./useLocalTemplatePillars";
import { updateLocalTemplateDraft } from "./useLocalTemplateDraft";

export interface MarkdownImportConflict {
  type: "pillar" | "question";
  localId: string;
  localValue: string;
  importedValue: string;
  imported?: { name: string; description: string };
  resolution?: "keep_local" | "keep_imported" | "merged";
}

/**
 * Import template from markdown structure.
 * Returns conflicts if any same-entity edits exist.
 */
export async function importLocalTemplateFromMarkdown(
  draftId: string,
  markdown: Partial<TemplateRevisionDetail>
): Promise<MarkdownImportConflict[]> {
  if (!draftId) throw new Error("draftId is required");

  const conflicts: MarkdownImportConflict[] = [];

  // Get existing structure
  const existingPillars = await withDatabase((db) =>
    db
      .select()
      .from(templatePillars)
      .where(eq(templatePillars.templateRevisionId, draftId))
  );

  // Build slug -> pillar map for conflict detection
  const existingBySlug = new Map(existingPillars.map((p) => [p.slug, p]));

  // Update metadata
  if (markdown.name || markdown.description) {
    await updateLocalTemplateDraft(draftId, {
      name: markdown.name,
      description: markdown.description,
    });
  }

  // Process pillars
  for (const pillar of markdown.pillars ?? []) {
    const existing = existingBySlug.get(pillar.slug);

    if (!existing) {
      // Add new pillar
      await addLocalPillar(
        draftId,
        pillar.name,
        pillar.slug,
        pillar.description
      );
      continue;
    }

    // Check for conflict
    const hasConflict =
      existing.name !== pillar.name ||
      existing.description !== (pillar.description ?? "");
    if (hasConflict) {
      conflicts.push({
        type: "pillar",
        localId: existing.id,
        localValue: `${existing.name}: ${existing.description}`,
        importedValue: `${pillar.name}: ${pillar.description ?? ""}`,
        imported: { name: pillar.name, description: pillar.description ?? "" },
      });
    }
  }

  // Record import
  await localMutation.localOnly({
    stateWrite: async (tx, { now }) => {
      await requireMutableRevision(tx, draftId);
      await tx.insert(templateRevisionImports).values({
        id: createUuidV7(),
        templateRevisionId: draftId,
        sourceType: "markdown",
        conflicts: JSON.stringify(conflicts),
        resolved: "[]",
        importedAt: now,
      });
    },
  });

  return conflicts;
}

/**
 * Resolve a conflict from import.
 */
export async function resolveLocalImportConflict(
  draftId: string,
  conflict: MarkdownImportConflict,
  resolution: "keep_local" | "keep_imported" | "merged"
): Promise<void> {
  if (!draftId) throw new Error("draftId is required");

  // Update the import record (local-only, no sync needed)
  await localMutation.localOnly({
    stateWrite: async (tx) => {
      await requireMutableRevision(tx, draftId);
      const imports = await tx
        .select()
        .from(templateRevisionImports)
        .where(eq(templateRevisionImports.templateRevisionId, draftId))
        .orderBy(desc(templateRevisionImports.importedAt))
        .limit(1);

      const imp = firstOrNull(imports);
      if (imp) {
        const resolved = safeParse<
          Array<MarkdownImportConflict & { resolution: string }>
        >(imp.resolved, []);
        resolved.push({ ...conflict, resolution });
        await tx
          .update(templateRevisionImports)
          .set({ resolved: JSON.stringify(resolved) })
          .where(eq(templateRevisionImports.id, imp.id));
      }
    },
  });

  // Apply resolution after recording provenance; updateLocalPillar() owns a
  // separate localOnly transaction.
  if (resolution === "keep_imported" && conflict.type === "pillar") {
    if (!conflict.imported) {
      throw new Error("conflict.imported is required to apply keep_imported");
    }
    await updateLocalPillar(conflict.localId, conflict.imported);
  }
}
