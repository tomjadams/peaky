/**
 * Workspace fixtures for per-Revision maturity tests (reviews/REQ-006;
 * maturity-score/REQ-014). Builds full ReviewWorkspace transport shapes from
 * the shared calculation vectors so the workspace layer asserts the same
 * numbers as the pure domain.
 */
import type { QuestionAnswer } from "~/models/question";
import type { OverrideTransition } from "~/services/maturity/override";
import type {
  BuildWorkspaceOptions,
  WorkspaceAnswer,
  WorkspacePillar,
  WorkspaceQuestion,
  WorkspaceTemplateRevision,
} from "~/models/workspace";
import { serializeMaturityDefinition } from "~/services/maturity/persistence";
import { makeDefinition, type VectorQuestion } from "./acceptanceVectors";
import { wholeQuestionAssociations } from "./calculationFixtures";

/** Serialized pinned definition with configured defaults for the question set. */
export function definitionJson(questions: readonly VectorQuestion[]): string {
  return serializeMaturityDefinition(
    makeDefinition(questions, wholeQuestionAssociations(questions))
  );
}

export function makeRevision(
  id: string,
  position: number,
  maturityDefinition: string | null
): WorkspaceTemplateRevision {
  return {
    id,
    templateId: `template:${id}`,
    name: `Template ${id}`,
    description: "",
    status: "published",
    revisionNumber: 1,
    revisionSummary: null,
    createdByActorId: "actor-1",
    updatedByActorId: "actor-1",
    publishedByActorId: "actor-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    publishedAt: "2026-01-01T00:00:00.000Z",
    position,
    maturityDefinition,
  };
}

export function makeQuestion(
  revisionId: string,
  question: VectorQuestion,
  order: number
): WorkspaceQuestion {
  return {
    id: question.questionId,
    templateRevisionId: revisionId,
    pillarId: question.pillarId,
    orderKey: String(order).padStart(4, "0"),
    text: `Text of ${question.questionId}`,
    type: question.type,
    riskLevel: question.severity,
    checklistItems:
      question.type === "checklist"
        ? question.practiceIds.map((id, itemOrder) => ({
            id,
            order: itemOrder,
            text: id,
          }))
        : undefined,
  };
}

/** One workspace pillar per distinct pillarId, authored order preserved. */
export function makePillars(
  revisionId: string,
  questions: readonly VectorQuestion[]
): WorkspacePillar[] {
  const pillarIds = [...new Set(questions.map((q) => q.pillarId))];
  return pillarIds.map((pillarId, pillarIndex) => ({
    id: pillarId,
    templateRevisionId: revisionId,
    slug: pillarId.toLowerCase(),
    name: `Pillar ${pillarId}`,
    orderKey: String(pillarIndex).padStart(4, "0"),
    questions: questions
      .filter((q) => q.pillarId === pillarId)
      .map((q, index) => makeQuestion(revisionId, q, index)),
  }));
}

/** Maps vector answers to workspace answers; a missing answer stays null. */
export function makeAnswers(
  questions: readonly VectorQuestion[]
): WorkspaceAnswer[] {
  return questions.map((question) => {
    const value = question.answer;
    let answer: QuestionAnswer = null;
    if (value === "yes" || value === "no" || value === "na") {
      answer = value;
    } else if (value) {
      answer = { checked: [...value.checked], na: [...value.na] };
    }
    return {
      questionId: question.questionId,
      answer,
      updatedAt: "2026-01-02T00:00:00.000Z",
    };
  });
}

export function makeWorkspaceOptions(parts: {
  templateRevisions: WorkspaceTemplateRevision[];
  pillars: WorkspacePillar[];
  answers: WorkspaceAnswer[];
  overrides?: OverrideTransition[];
}): BuildWorkspaceOptions {
  return {
    overrides: parts.overrides ?? [],
    review: {
      id: "review-1",
      name: "Review",
      status: "in-progress",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      teamId: "team-1",
      orgId: "org-1",
      assessors: [],
      reviewers: [],
    },
    subject: { id: "team-1", type: "team", name: "Team", slug: "team" },
    templateRevisions: parts.templateRevisions,
    pillars: parts.pillars,
    answers: parts.answers,
    notes: [],
    attachments: [],
    scores: [],
    capabilities: {
      canEdit: true,
      canPublish: false,
      canDelete: false,
      canAddParticipants: true,
      canExport: true,
    },
    recentHistory: [],
    answerProvenance: {},
  };
}
