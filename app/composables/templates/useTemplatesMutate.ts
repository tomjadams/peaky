import type { TemplateRevisionDetail } from "~/models";
import { saveTemplateRevisionDetail } from "./domain/useTemplateCatalog";

/** Save operations backed by the template domain API. */

export function useTemplatesMutate() {
  const saving = ref(false);
  const error = ref<Error | null>(null);

  const saveTemplate = async (
    template: TemplateRevisionDetail
  ): Promise<boolean> => {
    saving.value = true;
    error.value = null;

    try {
      await saveTemplateRevisionDetail(template);
      return true;
    } catch (err) {
      error.value =
        err instanceof Error ? err : new Error("Failed to save template");
      return false;
    } finally {
      saving.value = false;
    }
  };

  return {
    saving: readonly(saving),
    error: readonly(error),
    saveTemplate,
  };
}
