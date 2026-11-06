/**
 * Fixture builders for improvement plan projection tests.
 *
 * Creates review, template, answer, and contributor shapes
 * needed to test attention-item classification, summary counts,
 * sorting, rollup grouping, and product contributor aggregation.
 */

import type {
  TemplateRevisionDetail,
  TemplatePillar,
  TemplateQuestion,
  RiskLevel,
} from "~/models/template";
import type { AnswerStateLike } from "~/services/review/ReviewProjection";
import type {
  PlanContributor,
  PlanItem,
  PlanItemIdentity,
} from "~/models/improvement-plan";
import type { NotApplicableReason } from "~/models/question";

// ─── Counter for unique IDs ──────────────────────────────────

let nextId = 1;
function uid(prefix = "id"): string {
  return `${prefix}-${nextId++}`;
}

/** Reset ID counter between test runs for deterministic IDs. */
export function resetFixtureIds(): void {
  nextId = 1;
}

// ─── Template Question Builder ────────────────────────────────

export interface TemplateQuestionOverrides {
  id?: string;
  order?: number;
  text?: string;
  type?: "yes-no" | "checklist";
  riskLevel?: RiskLevel;
  importance?: string;
  checklistItems?: { id: string; order: number; text: string }[];
  leadingPractices?: { id: string; order: number; text: string }[];
  helpfulLinks?: { title: string; url: string }[];
}

export function makeTemplateQuestion(
  overrides: TemplateQuestionOverrides = {}
): TemplateQuestion {
  const id = overrides.id ?? uid("q");
  return {
    id,
    order: overrides.order ?? 1,
    text: overrides.text ?? `Question ${id}`,
    type: overrides.type ?? "yes-no",
    riskLevel: overrides.riskLevel ?? "medium",
    importance: overrides.importance ?? "Standard importance",
    checklistItems: overrides.checklistItems,
    leadingPractices: overrides.leadingPractices ?? [],
    helpfulLinks: overrides.helpfulLinks ?? [],
  };
}

// ─── Template Pillar Builder ───────────────────────────────────

export interface TemplatePillarOverrides {
  id?: string;
  templateRevisionId?: string;
  slug?: string;
  name?: string;
  description?: string;
  order?: number;
  questions?: TemplateQuestion[];
}

export function makeTemplatePillar(
  overrides: TemplatePillarOverrides = {}
): TemplatePillar {
  const slug = overrides.slug ?? uid("pillar");
  return {
    id: overrides.id ?? uid("pillar-row"),
    templateRevisionId: overrides.templateRevisionId ?? "revision-fixture",
    slug,
    name: overrides.name ?? `Pillar ${slug}`,
    description: overrides.description,
    order: overrides.order ?? 1,
    questions: overrides.questions ?? [makeTemplateQuestion()],
  };
}

// ─── Template Detail Builder ───────────────────────────────────

export interface TemplateRevisionDetailOverrides {
  id?: string;
  templateId?: string;
  name?: string;
  status?: "draft" | "published" | "retired";
  revisionNumber?: number | null;
  revisionSummary?: string | null;
  description?: string;
  pillars?: TemplatePillar[];
}

export function makeTemplateRevisionDetail(
  overrides: TemplateRevisionDetailOverrides = {}
): TemplateRevisionDetail {
  const id = overrides.id ?? uid("revision");
  const templateId = overrides.templateId ?? uid("template");
  const status = overrides.status ?? "published";
  const revisionNumber =
    overrides.revisionNumber ?? (status === "draft" ? null : 1);
  const published = status !== "draft";
  const pillars = overrides.pillars ?? [makeTemplatePillar()];
  for (const pillar of pillars) pillar.templateRevisionId = id;
  return {
    id,
    templateId,
    name: overrides.name ?? "Test Template",
    description: overrides.description ?? "",
    status,
    revisionNumber,
    revisionSummary: overrides.revisionSummary ?? null,
    createdByActorId: "actor-system",
    updatedByActorId: "actor-system",
    publishedByActorId: published ? "actor-system" : null,
    createdAt: "2026-08-20T10:00:00Z",
    updatedAt: "2026-08-20T10:00:00Z",
    publishedAt: published ? "2026-08-20T10:00:00Z" : null,
    pillars,
  };
}

// ─── Multi-Template Builder ───────────────────────────────────

/**
 * Create two template details for multi-template review testing.
 */
export function makeMultiTemplateRevisionDetails(): {
  templateA: TemplateRevisionDetail;
  templateB: TemplateRevisionDetail;
} {
  const templateA = makeTemplateRevisionDetail({
    id: "tpl-a",
    name: "Security Review",
    pillars: [
      makeTemplatePillar({
        slug: "security",
        name: "Security",
        questions: [
          makeTemplateQuestion({
            id: "q-a1",
            riskLevel: "critical",
            text: "Is auth configured?",
          }),
          makeTemplateQuestion({
            id: "q-a2",
            riskLevel: "high",
            text: "Is encryption enabled?",
          }),
        ],
      }),
    ],
  });

  const templateB = makeTemplateRevisionDetail({
    id: "tpl-b",
    name: "Reliability Review",
    pillars: [
      makeTemplatePillar({
        slug: "reliability",
        name: "Reliability",
        questions: [
          makeTemplateQuestion({
            id: "q-b1",
            riskLevel: "medium",
            text: "Are health checks in place?",
          }),
        ],
      }),
    ],
  });

  return { templateA, templateB };
}

// ─── Answer Row Builders ──────────────────────────────────────

export function makeYesAnswer(questionId: string): AnswerStateLike {
  return { questionId, answer: '"yes"' };
}

export function makeNoAnswer(questionId: string): AnswerStateLike {
  return { questionId, answer: '"no"' };
}

export function makeNAAnswer(
  questionId: string,
  reason?: NotApplicableReason
): AnswerStateLike {
  return {
    questionId,
    answer: '"na"',
    naReason: reason
      ? JSON.stringify(reason)
      : JSON.stringify({ reason: "other", comment: "Not applicable" }),
  };
}

export function makeUnanswered(questionId: string): AnswerStateLike {
  return { questionId, answer: null };
}

export function makeChecklistAnswer(
  questionId: string,
  checked: string[],
  na: string[] = []
): AnswerStateLike {
  return {
    questionId,
    answer: JSON.stringify({ checked, na }),
  };
}

export function makeChecklistAnswerWithItemNA(
  questionId: string,
  checked: string[],
  na: string[],
  itemNaReasons: Record<string, NotApplicableReason>
): AnswerStateLike {
  return {
    questionId,
    answer: JSON.stringify({ checked, na }),
    itemNaReasons: JSON.stringify(itemNaReasons),
  };
}

// ─── Checklist Question Template ──────────────────────────────

export function makeChecklistTemplateQuestion(
  items: { id?: string; text: string }[] = [
    { text: "Practice A" },
    { text: "Practice B" },
    { text: "Practice C" },
  ],
  overrides: TemplateQuestionOverrides = {}
): TemplateQuestion {
  const checklistItems = items.map((item, i) => ({
    id: item.id ?? uid("cl"),
    order: i + 1,
    text: item.text,
  }));
  return makeTemplateQuestion({
    type: "checklist",
    checklistItems,
    ...overrides,
  });
}

// ─── Team Review Context ──────────────────────────────────────

export interface ReviewContext {
  reviewId: string;
  subjectId: string;
  subjectType: "team" | "product" | "application";
  templates: TemplateRevisionDetail[];
  answers: AnswerStateLike[];
}

export function makeTeamReviewContext(
  overrides: Partial<ReviewContext> = {}
): ReviewContext {
  return {
    reviewId: overrides.reviewId ?? uid("review"),
    subjectId: overrides.subjectId ?? uid("team"),
    subjectType: overrides.subjectType ?? "team",
    templates: overrides.templates ?? [makeTemplateRevisionDetail()],
    answers: overrides.answers ?? [],
  };
}

// TODO(phase-5): used by product contributor tests
export function makeProductReviewContext(
  overrides: Partial<ReviewContext> = {}
): ReviewContext {
  return makeTeamReviewContext({
    subjectType: "product",
    ...overrides,
  });
}

// TODO(phase-5): used by product contributor tests
export function makeApplicationReviewContext(
  overrides: Partial<ReviewContext> = {}
): ReviewContext {
  return makeTeamReviewContext({
    subjectType: "application",
    ...overrides,
  });
}

// ─── Plan Item Builder (for expected test output) ─────────────

export function makePlanItem(
  overrides: Omit<Partial<PlanItem>, "identity"> & {
    identity?: Partial<PlanItemIdentity>;
  } = {}
): PlanItem {
  const id = overrides.identity?.questionId ?? uid("q");
  return {
    ...overrides,
    identity: {
      reviewId: "review-1",
      subjectId: "team-1",
      subjectType: "team",
      templateId: "tpl-1",
      templateRevisionId: "revision-1",
      pillarSlug: "security",
      questionId: id,
      ...overrides.identity,
    },
    state: overrides.state ?? "not-assessed",
    severity: overrides.severity ?? "medium",
    questionText: overrides.questionText ?? `Question ${id}`,
    questionReference:
      overrides.questionReference === undefined
        ? "SEC-1"
        : overrides.questionReference,
    pillarName: overrides.pillarName ?? "Security",
    templateName: overrides.templateName ?? "Test Template",
    revisionNumber: overrides.revisionNumber ?? 1,
    explanation:
      overrides.explanation ?? "This question has not been assessed yet",
  };
}

// ─── Plan Contributor Builder ─────────────────────────────────

export function makePlanContributor(
  overrides: Partial<PlanContributor> = {}
): PlanContributor {
  return {
    reviewId: overrides.reviewId ?? uid("review"),
    reviewName: overrides.reviewName ?? "Test Review",
    contributorType: overrides.contributorType ?? "product-review",
    sourceName: overrides.sourceName ?? "Test Product",
    sourceId: overrides.sourceId ?? uid("source"),
    summary: overrides.summary ?? {
      followUp: 0,
      checklistGaps: 0,
      notAssessed: 0,
      documentedExceptions: 0,
      total: 0,
      critical: 0,
      high: 0,
    },
    topArea: overrides.topArea ?? null,
  };
}
