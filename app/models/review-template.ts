import type { Pillar } from "./pillar";
import type { TemplateId, TemplateRevisionId } from "./template";

export interface ReviewTemplate {
  templateId: TemplateId;
  templateRevisionId: TemplateRevisionId;
  templateName: string;
  revisionNumber: number | null;
  revisionSummary: string | null;
  progress: number;
  pillars: Pillar[];
}
