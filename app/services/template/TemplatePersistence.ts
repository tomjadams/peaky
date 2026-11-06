import type { TemplateRevisionDetail, TemplateRevisionId } from "~/models";
import {
  importLocalTemplateFromMarkdown,
  resolveLocalImportConflict,
  type MarkdownImportConflict,
} from "~/composables/local/useLocalTemplateImport";
import {
  createLocalTemplateDraft,
  updateLocalTemplateDraft,
  type CreateLocalTemplateDraftInput,
} from "~/composables/local/useLocalTemplateDraft";
import { TemplateWriteUnavailableError } from "./TemplateRevisionContracts";

export type { MarkdownImportConflict };

type TemplateDraftMetadata = Pick<
  TemplateRevisionDetail,
  "name" | "description"
>;

export class TemplatePersistence {
  async importFromMarkdown(
    draftId: string,
    template: Partial<TemplateRevisionDetail>
  ): Promise<MarkdownImportConflict[]> {
    return importLocalTemplateFromMarkdown(draftId, template);
  }

  async resolveImportConflict(
    draftId: string,
    conflict: MarkdownImportConflict,
    resolution: "keep_local" | "keep_imported" | "merged"
  ): Promise<void> {
    return resolveLocalImportConflict(draftId, conflict, resolution);
  }

  async createDraft(
    input: CreateLocalTemplateDraftInput
  ): Promise<TemplateRevisionId> {
    return createLocalTemplateDraft(input);
  }

  async saveDraftMetadata(
    metadata: TemplateDraftMetadata,
    draftId: string | null
  ): Promise<string> {
    if (!draftId) throw new TemplateWriteUnavailableError();

    await updateLocalTemplateDraft(draftId, {
      name: metadata.name,
      description: metadata.description,
    });

    return draftId;
  }
}

export const templatePersistence = new TemplatePersistence();
