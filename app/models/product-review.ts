import type { Pillar } from "./pillar";
import type { ReviewParticipant, ReviewStatus } from "./review";
import type { ReviewTemplate } from "./review-template";
import type { TemplateRevisionId } from "./template";

export interface ProductReview {
  id: string;
  name: string;
  productId: string;
  applicationId?: string;
  templateId: string;
  templateRevisionId: TemplateRevisionId;
  templateName: string;
  pillars: Pillar[];
  templateIds: string[];
  templateRevisionIds: TemplateRevisionId[];
  templateNames: string[];
  templates: ReviewTemplate[];
  applicationIds?: string[];
  status: ReviewStatus;
  createdAt: string;
  updatedAt: string;
  assessors: ReviewParticipant[];
  advisors?: ReviewParticipant[];
  reviewers?: ReviewParticipant[];
}
