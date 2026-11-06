/**
 * Review workspace projection - page-oriented read model for assessment hydration.
 *
 * Instead of many chatty reads, the workspace provides all data needed for the
 * assessment screen in a single response. This is useful both now (simpler remote
 * hydration) and later (projection assembled from local synced tables).
 *
 * @see site/docs/development/walkthroughs/local-first-api.md
 */

import type { ReviewStatus, ReviewParticipant } from "~/models";
import type { OverrideTransition } from "~/services/maturity/override";
import {
  deriveWorkspaceMaturity,
  type WorkspaceMaturityEntry,
} from "~/services/maturity/workspace";
import type { QuestionAnswer, NotApplicableReason } from "./question";
import type { TemplateRevision } from "./template";

// Re-export for convenience
export type { QuestionAnswer, NotApplicableReason };
export type { WorkspaceMaturityEntry };

// === Subject Types ===

export type SubjectType = "team" | "product" | "application" | "organization";

export interface WorkspaceSubject {
  id: string;
  type: SubjectType;
  name: string;
  slug: string;
  organizationId?: string;
  organizationName?: string;
}

// === Template Types ===

export interface WorkspaceTemplateRevision extends TemplateRevision {
  position: number; // Order when multiple templates
  /**
   * Serialized, schema-versioned MaturityDefinition JSON pinned with the
   * Revision snapshot (maturity-score/REQ-009). null/absent is the explicit
   * no-definition state (AC-060) — never an invented default.
   */
  maturityDefinition?: string | null;
}

export interface WorkspacePillar {
  id: string;
  templateRevisionId: string;
  slug: string;
  name: string;
  description?: string;
  orderKey: string;
  questions: WorkspaceQuestion[];
}

export interface WorkspaceQuestion {
  id: string;
  templateRevisionId: string;
  pillarId: string;
  orderKey: string;
  text: string;
  type: "yes-no" | "checklist";
  riskLevel?: "critical" | "high" | "medium";
  importance?: string;
  checklistItems?: Array<{ id: string; order: number; text: string }>;
  leadingPractices?: Array<{ id: string; order: number; text: string }>;
  helpfulLinks?: Array<{ title: string; url: string }>;
}

export interface WorkspaceAnswer {
  questionId: string;
  answer: QuestionAnswer;
  naReason?: NotApplicableReason;
  itemNaReasons?: Record<string, NotApplicableReason>;
  updatedAt: string;
}

// === Note Types ===

export type NoteScope = "review" | "pillar" | "question";

export interface WorkspaceNote {
  id: string;
  scopeType: NoteScope;
  scopeId: string;
  content: string;
  updatedAt: string;
}

// === Attachment Types ===

export interface WorkspaceAttachment {
  id: string;
  scopeType: NoteScope;
  scopeId: string;
  filename: string;
  objectKey: string;
  mimeType?: string;
  size?: number;
  createdAt: string;
}

// === Score Types ===

export interface WorkspaceScore {
  scoreType: "readiness" | "maturity";
  numericScore?: number;
  band?: string;
  scoreBreakdown?: Record<string, number>;
  computedAt: string;
}

// === History Types ===

export type ActorType = "user" | "integration" | "system";

export interface WorkspaceHistoryEntry {
  id: string;
  eventType: string;
  actorType: ActorType;
  actorId: string;
  actorName?: string;
  summary: string; // Human-readable summary
  data?: Record<string, unknown>;
  time: string;
}

// === Capability Types ===

export interface WorkspaceCapabilities {
  canEdit: boolean;
  canPublish: boolean;
  canDelete: boolean;
  canAddParticipants: boolean;
  canExport: boolean;
}

// === Provenance Types ===

export interface AnswerProvenance {
  source: string; // e.g., "ci-cd", "catalog-sync"
  runId?: string;
  timestamp: string;
  confidence?: number;
  evidence?: string[];
}

// === Main Workspace Response ===

export interface ReviewWorkspace {
  // Core review
  review: {
    id: string;
    name: string;
    status: ReviewStatus;
    templateRevisionIds: string[];
    createdAt: string;
    updatedAt: string;
  };

  // Routed subject context. A linked application may differ from the Review owner.
  subject: WorkspaceSubject;

  // Persisted Review owner used to materialize the local FK parent safely.
  reviewSubject: WorkspaceSubject;

  // Template context
  templateRevisions: WorkspaceTemplateRevision[];
  pillars: WorkspacePillar[];

  // Current state
  answers: WorkspaceAnswer[];
  notes: WorkspaceNote[];
  attachments: WorkspaceAttachment[];
  scores: WorkspaceScore[];

  /**
   * Per-Revision maturity, derived on read from the pinned definition, that
   * Revision's questions, and current answers — one entry per selected
   * Revision, never a combined score (reviews/AC-030, AC-031;
   * maturity-score/REQ-014; AC-025). Calculated results are not persisted.
   */
  maturity: WorkspaceMaturityEntry[];

  // Participants
  assessors: ReviewParticipant[];
  advisors: ReviewParticipant[];
  reviewers?: ReviewParticipant[];

  // Capabilities
  capabilities: WorkspaceCapabilities;

  // Recent history (for quick context)
  recentHistory: WorkspaceHistoryEntry[];

  // Provenance for machine-generated answers
  answerProvenance: Record<string, AnswerProvenance>;
}

export interface BuildWorkspaceOptions {
  review: {
    id: string;
    name: string;
    status: ReviewStatus;
    createdAt: string;
    updatedAt: string;
    teamId: string;
    orgId: string;
    assessors: ReviewParticipant[];
    advisors?: ReviewParticipant[];
    reviewers?: ReviewParticipant[];
  };
  subject: WorkspaceSubject;
  /** Persisted owner identity when the routed subject is only a linked view. */
  reviewSubject?: WorkspaceSubject;
  templateRevisions: WorkspaceTemplateRevision[];
  pillars: WorkspacePillar[];
  answers: WorkspaceAnswer[];
  notes: WorkspaceNote[];
  attachments: WorkspaceAttachment[];
  scores: WorkspaceScore[];
  capabilities: WorkspaceCapabilities;
  recentHistory: WorkspaceHistoryEntry[];
  answerProvenance: Record<string, AnswerProvenance>;
  /**
   * Append-only Advisor override transitions for this Review
   * (maturity-score/REQ-016); resolved on read into each Revision's
   * effective result. Defaults to none.
   */
  overrides?: OverrideTransition[];
}

/**
 * Build a workspace response from various data sources.
 * This is the server-side factory for the projection.
 */
export function buildWorkspace(
  options: BuildWorkspaceOptions
): ReviewWorkspace {
  const {
    review,
    subject,
    reviewSubject = subject,
    templateRevisions,
    pillars,
    answers,
    notes,
    attachments,
    scores,
    capabilities,
    recentHistory,
    answerProvenance,
  } = options;
  return {
    review: {
      id: review.id,
      name: review.name,
      status: review.status,
      templateRevisionIds: templateRevisions
        .toSorted((left, right) => left.position - right.position)
        .map((revision) => revision.id),
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
    },
    subject,
    reviewSubject,
    templateRevisions,
    pillars,
    answers,
    notes,
    attachments,
    scores,
    maturity: deriveWorkspaceMaturity({
      reviewId: review.id,
      templateRevisions,
      pillars,
      answers,
      overrides: options.overrides ?? [],
    }),
    assessors: review.assessors,
    advisors: review.advisors ?? review.reviewers ?? [],
    reviewers: review.reviewers,
    capabilities,
    recentHistory,
    answerProvenance,
  };
}
