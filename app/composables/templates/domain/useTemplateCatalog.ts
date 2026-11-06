import { computed, ref } from "vue";
import type {
  TemplateRevisionDetail,
  TemplateCatalogEntry,
  TemplateRevisionDetailResponse,
} from "~/models";
import {
  templateCatalog,
  createEmptyTemplate,
} from "~/services/template/TemplateCatalog";

export { createEmptyTemplate };

export async function fetchTemplateRevisionDetail(
  id: string
): Promise<TemplateRevisionDetail> {
  return templateCatalog.fetchDetail(id);
}

export async function fetchTemplateAuthoringDetail(
  id: string
): Promise<TemplateRevisionDetailResponse> {
  return templateCatalog.fetchAuthoringDetail(id);
}

export async function canEditTemplateDraft(
  templateId: string
): Promise<boolean> {
  return templateCatalog.canEditDraft(templateId);
}

export async function saveTemplateRevisionDetail(
  template: TemplateRevisionDetail
): Promise<TemplateRevisionDetail> {
  return templateCatalog.saveDetail(template);
}

export async function publishTemplateDraft(templateId: string) {
  return templateCatalog.publish(templateId);
}

export function useTemplateCatalog() {
  const templates = ref<TemplateCatalogEntry[]>([]);
  const error = ref<Error | null>(null);
  const pending = ref(false);

  const refresh = async (): Promise<void> => {
    pending.value = true;
    error.value = null;

    try {
      const result = await templateCatalog.fetchAll();
      templates.value = result.templates;
      if (result.error) {
        error.value = result.error;
      }
    } catch (err) {
      error.value = err instanceof Error ? err : new Error(String(err));
    } finally {
      pending.value = false;
    }
  };

  void refresh();

  return {
    templates: computed(() => templates.value),
    error,
    pending,
    refresh,
  };
}
