/**
 * Handoff practice projection (improvement-plans/REQ-005; AC-015 through
 * AC-020).
 *
 * Derives the selectable unmet practices of a Review from its pinned
 * TemplateRevisions and current answers. Each unmet, non-N/A checklist item
 * is one independently selectable practice (AC-015); a Yes/No question
 * answered "no" is one practice reusing its question ID (AC-016). Every
 * selected Revision contributes its own practices with exact, unparsed
 * `templateRevisionId` identity — there is no cross-Revision rollup
 * (AC-017, AC-020).
 *
 * Pure module: no I/O, no Vue, no Nitro, no database.
 */
import type { RiskLevel } from "~/models/template";
import {
  isChecklistAnswer,
  isChecklistWithNAAnswer,
  type QuestionAnswer,
} from "~/models/question";
import { safeParse } from "~/local-db";
import { normalizeQuestionAnswer } from "~/services/assessment/answerSemantics";
import {
  assessmentDeepLink,
  type ReviewContext,
} from "~/services/review/ImprovementPlanProjection";
import type { AnswerStateLike } from "~/services/review/ReviewProjection";
import {
  practiceEntityId,
  type PracticeEvidence,
  type PracticeReference,
} from "./practice";
import type { ExternalWorkItemReference } from "./association";

/**
 * One selectable unmet practice in the handoff projection. Carries the full
 * actionable context AC-018 requires: pinned Revision identity, question and
 * practice identity, binary evidence state with provenance, an assessment
 * deep link, and any current external reference.
 */
export interface SelectablePractice {
  readonly reference: PracticeReference;
  /** Deterministic entity ID of the practice row (design Decision 3). */
  readonly entityId: string;
  /** Practice text (checklist item) or question text (Yes/No). */
  readonly title: string;
  readonly questionText: string;
  readonly pillarSlug: string;
  readonly pillarName: string;
  readonly templateName: string;
  readonly revisionNumber: number | null;
  readonly severity: RiskLevel;
  readonly evidence: PracticeEvidence;
  readonly leadingPractices: readonly string[];
  readonly helpfulLinks: readonly { title: string; url: string }[];
  /** Deep link to the source assessment question (AC-018). */
  readonly deepLink: ReturnType<typeof assessmentDeepLink>;
  /** Current external work-item reference, when associated (AC-018). */
  readonly currentAssociation: ExternalWorkItemReference | null;
}

interface ChecklistAnswerParts {
  readonly checked: ReadonlySet<string>;
  readonly na: ReadonlySet<string>;
}

function parseChecklistParts(answer: QuestionAnswer): ChecklistAnswerParts {
  if (isChecklistWithNAAnswer(answer)) {
    return {
      checked: new Set(answer.checked),
      na: new Set(answer.na),
    };
  }
  if (isChecklistAnswer(answer)) {
    return { checked: new Set(answer), na: new Set<string>() };
  }
  return { checked: new Set<string>(), na: new Set<string>() };
}

interface ProjectionContext {
  readonly answerByQuestionId: ReadonlyMap<string, AnswerStateLike>;
  readonly currentAssociations:
    | ReadonlyMap<string, ExternalWorkItemReference>
    | undefined;
}

/** Shared per-question row context passed to each built practice. */
interface QuestionRowContext {
  readonly questionText: string;
  readonly pillarSlug: string;
  readonly pillarName: string;
  readonly templateId: string;
  readonly templateName: string;
  readonly revisionNumber: number | null;
  readonly severity: RiskLevel;
  readonly subjectId: string;
  readonly subjectType: "team" | "product" | "application";
  readonly leadingPractices: readonly string[];
  readonly helpfulLinks: readonly { title: string; url: string }[];
}

function buildPractice(
  reference: PracticeReference,
  evidence: PracticeEvidence,
  row: QuestionRowContext & { title: string },
  ctx: ProjectionContext
): SelectablePractice {
  const entityId = practiceEntityId(reference);
  return {
    reference,
    entityId,
    title: row.title,
    questionText: row.questionText,
    pillarSlug: row.pillarSlug,
    pillarName: row.pillarName,
    templateName: row.templateName,
    revisionNumber: row.revisionNumber,
    severity: row.severity,
    evidence,
    leadingPractices: row.leadingPractices,
    helpfulLinks: row.helpfulLinks,
    deepLink: assessmentDeepLink({
      reviewId: reference.reviewId,
      subjectId: row.subjectId,
      subjectType: row.subjectType,
      templateId: row.templateId,
      templateRevisionId: reference.templateRevisionId,
      pillarSlug: row.pillarSlug,
      questionId: reference.questionId,
    }),
    currentAssociation: ctx.currentAssociations?.get(entityId) ?? null,
  };
}

/**
 * Projects the unmet, non-N/A checklist items of one checklist question as
 * independent practices (AC-015).
 */
function projectChecklistPractices(
  question: {
    items: readonly { id: string; text: string }[];
    answer: QuestionAnswer;
    referenceBase: Omit<PracticeReference, "practiceId">;
  },
  shared: QuestionRowContext,
  ctx: ProjectionContext
): SelectablePractice[] {
  const { checked, na } = parseChecklistParts(question.answer);
  return question.items
    .filter((item) => !checked.has(item.id) && !na.has(item.id))
    .map((item) =>
      buildPractice(
        { ...question.referenceBase, practiceId: item.id },
        {
          state: "unmet",
          provenance: { kind: "checklist-item", checked: false },
        },
        { ...shared, title: item.text },
        ctx
      )
    );
}

/**
 * Resolves the assessment deep link for a persisted practice reference —
 * including one whose practice has since left the projection (its answer
 * changed after selection). Looks the owning pillar up from the context by
 * exact, unparsed `templateRevisionId` and question ID; returns null when
 * the context no longer contains the reference.
 */
export function practiceDeepLinkFromContext(
  ctx: ReviewContext,
  reference: PracticeReference
): ReturnType<typeof assessmentDeepLink> | null {
  const template = ctx.templates.find(
    (candidate) => candidate.id === reference.templateRevisionId
  );
  if (!template) return null;
  const pillar = template.pillars.find((candidate) =>
    candidate.questions.some((question) => question.id === reference.questionId)
  );
  if (!pillar) return null;
  return assessmentDeepLink({
    reviewId: reference.reviewId,
    subjectId: ctx.subjectId,
    subjectType: ctx.subjectType,
    templateId: template.templateId,
    templateRevisionId: reference.templateRevisionId,
    pillarSlug: pillar.slug,
    questionId: reference.questionId,
  });
}

/**
 * Projects every selectable unmet practice across all of the Review's
 * selected TemplateRevisions, in template and pillar order. N/A answers —
 * question-level and per checklist item — are excluded (AC-019).
 */
export function projectSelectablePractices(
  ctx: ReviewContext,
  currentAssociations?: ReadonlyMap<string, ExternalWorkItemReference>
): SelectablePractice[] {
  const projection: ProjectionContext = {
    answerByQuestionId: new Map(
      ctx.answers.map((answer) => [answer.questionId, answer] as const)
    ),
    currentAssociations,
  };

  // Flatten the template→pillar→question hierarchy into a single iterable
  // to avoid triple-nested loops triggering max-depth.
  const allQuestions = ctx.templates.flatMap((template) =>
    template.pillars.flatMap((pillar) =>
      pillar.questions.map((question) => ({ question, pillar, template }))
    )
  );

  const practices: SelectablePractice[] = [];
  for (const { question, pillar, template } of allQuestions) {
    const stored = projection.answerByQuestionId.get(question.id);
    const answer = normalizeQuestionAnswer(
      question,
      safeParse(stored?.answer, null)
    );
    const shared: QuestionRowContext = {
      questionText: question.text,
      pillarSlug: pillar.slug,
      pillarName: pillar.name,
      templateId: template.templateId,
      templateName: template.name,
      revisionNumber: template.revisionNumber,
      severity: question.riskLevel,
      subjectId: ctx.subjectId,
      subjectType: ctx.subjectType,
      leadingPractices: question.leadingPractices.map((p) => p.text),
      helpfulLinks: question.helpfulLinks,
    };
    const referenceBase = {
      reviewId: ctx.reviewId,
      templateRevisionId: template.id,
      questionId: question.id,
    };

    if (question.type === "checklist") {
      // A missing or explicitly null answer is not assessed. Only a recorded
      // checklist shape makes unchecked items explicit unmet evidence. An
      // empty array/object is still recorded and therefore projects every
      // applicable item as unmet.
      if (!isChecklistAnswer(answer) && !isChecklistWithNAAnswer(answer)) {
        continue;
      }
      practices.push(
        ...projectChecklistPractices(
          {
            items: question.checklistItems ?? [],
            answer,
            referenceBase,
          },
          shared,
          projection
        )
      );
      continue;
    }

    // Yes/No: only a recorded "no" is an unmet practice (AC-016); N/A,
    // "yes", and unanswered questions project no practice (AC-019).
    if (answer !== "no") continue;
    practices.push(
      buildPractice(
        { ...referenceBase, practiceId: question.id },
        { state: "unmet", provenance: { kind: "yes-no", answer: "no" } },
        { ...shared, title: question.text },
        projection
      )
    );
  }

  return practices;
}
