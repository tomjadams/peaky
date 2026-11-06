import type { Pillar } from "./pillar";
import type { ReviewTemplate } from "./review-template";
import type { TemplateRevisionId } from "./template";

export type ReviewStatus = "draft" | "in-progress" | "completed" | "archived";

export interface ReviewTemplateSelection {
  reviewId: string;
  templateRevisionId: TemplateRevisionId;
  position: number;
}

/**
 * A person involved in a review.
 * Used for both team members and advisors.
 */
export interface ReviewParticipant {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

/**
 * Summary row used by subject review tables.
 *
 * Example subjects:
 * - product review list on `/products/:productId`
 * - team review list on `/teams/:teamId`
 */
export interface ReviewSummary {
  id: string;
  name: string;
  templateIds: string[];
  templateRevisionIds?: TemplateRevisionId[];
  templateNames: string[];
  status: ReviewStatus;
  progress: number;
  createdAt: string;
  updatedAt: string;
  assessors: ReviewParticipant[];
  advisors?: ReviewParticipant[];
  reviewers?: ReviewParticipant[];
}

export interface Review {
  id: string;
  name: string;
  subjectId?: string;
  teamId: string;
  orgId: string;
  applicationId?: string;
  templateId: string;
  templateRevisionId?: TemplateRevisionId;
  templateName: string;
  pillars: Pillar[];
  templateIds: string[];
  templateRevisionIds?: TemplateRevisionId[];
  templateNames: string[];
  templates: ReviewTemplate[];
  applicationIds?: string[];
  status: ReviewStatus;
  createdAt: string;
  updatedAt: string;
  /**
   * Team members who collectively own the application and perform the self-assessment.
   * They answer the questions and provide evidence. Using "Team" emphasizes
   * collective ownership and avoids individual hero culture.
   */
  assessors: ReviewParticipant[];
  /**
   * Advisors: experienced engineers who provide guidance, historical context,
   * and incident knowledge. They review the assessment and help educate the team.
   * Maximum 2 advisors per review for focused guidance.
   * This educational aspect is what makes Peaky more than just a checklist.
   */
  advisors?: ReviewParticipant[];
  reviewers?: ReviewParticipant[];
}
