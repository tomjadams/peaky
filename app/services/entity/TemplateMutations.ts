import type { PublishResponse } from "~/models/template";
import { templateWriteUnavailableResult } from "~/services/template/TemplateRevisionContracts";

export class TemplateMutations {
  async publish(templateId: string): Promise<PublishResponse> {
    if (!templateId) throw new Error("templateId is required");
    return templateWriteUnavailableResult(
      "Template publication is unavailable"
    );
  }
}

export const templateMutations = new TemplateMutations();
