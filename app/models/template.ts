import type { HelpfulLink, ChecklistItem } from "./question";

export type TemplateLifecycleStatus = "active" | "archived";
export type TemplateRevisionStatus = "draft" | "published" | "retired";
type Brand<T, Name extends string> = T & { readonly __brand?: Name };
export type TemplateId = Brand<string, "TemplateId">;
export type TemplateRevisionId = Brand<string, "TemplateRevisionId">;
export type TemplatePillarId = Brand<string, "TemplatePillarId">;
export type TemplateQuestionId = Brand<string, "TemplateQuestionId">;
export type ActorId = Brand<string, "ActorId">;
export type TeamId = Brand<string, "TeamId">;
export type RiskLevel = "critical" | "high" | "medium";

export interface Template {
  id: TemplateId;
  name: string;
  description: string;
  status: TemplateLifecycleStatus;
  ownerTeamId: TeamId;
  createdByActorId: ActorId;
  updatedByActorId: ActorId;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateRevision {
  id: TemplateRevisionId;
  templateId: TemplateId;
  name: string;
  description: string;
  status: TemplateRevisionStatus;
  revisionNumber: number | null;
  revisionSummary: string | null;
  createdByActorId: ActorId;
  updatedByActorId: ActorId;
  publishedByActorId: ActorId | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

export interface LeadingPractice {
  id: string;
  order: number;
  text: string;
}

export interface TemplateQuestion {
  id: TemplateQuestionId;
  order: number;
  type?: "yes-no" | "checklist";
  text: string;
  riskLevel: RiskLevel;
  importance: string;
  checklistItems?: ChecklistItem[];
  leadingPractices: LeadingPractice[];
  helpfulLinks: HelpfulLink[];
}

export interface TemplatePillar {
  id: TemplatePillarId;
  templateRevisionId: TemplateRevisionId;
  slug: string;
  name: string;
  description?: string;
  order: number;
  questions: TemplateQuestion[];
}

export interface TemplateRevisionDetail extends TemplateRevision {
  pillars: TemplatePillar[];
  /**
   * Serialized, schema-versioned MaturityDefinition JSON document stored with
   * the Revision (maturity-score/REQ-009). Decode with
   * `decodeMaturityDefinition` from `~/services/maturity/persistence`.
   * null/absent is the explicit no-definition state (AC-060).
   */
  maturityDefinition?: string | null;
}

export interface TemplateAuthoringDetail {
  template: Template;
  draftRevision: TemplateRevisionDetail | null;
}

export interface TemplateStats {
  reviewsCount: number;
  applicationsCount: number;
  organizationsCount: number;
}

export type TemplateRevisionSummary = Pick<
  TemplateRevision,
  | "id"
  | "templateId"
  | "name"
  | "description"
  | "status"
  | "revisionNumber"
  | "revisionSummary"
  | "publishedAt"
>;

export interface TemplateCatalogEntry {
  template: Template;
  draftRevision: TemplateRevisionSummary | null;
  publishedRevisions: TemplateRevisionSummary[];
  pillarSlugsByRevisionId: Record<string, string[]>;
  reviewsCount?: number;
  canEditDraft?: boolean;
  stats?: TemplateStats;
}

export interface TemplatesResponse {
  templates: TemplateCatalogEntry[];
}

export interface TemplateRevisionDetailResponse {
  template: Template;
  revision: TemplateRevisionDetail | null;
}

export interface PublishResponse {
  success: boolean;
  code?: "template_write_unavailable";
  errors?: string[];
  revision?: TemplateRevisionDetail;
}
