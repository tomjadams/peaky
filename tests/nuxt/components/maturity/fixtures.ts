/**
 * Component-test fixtures for the maturity results UI
 * (maturity-score/REQ-013 through REQ-016). Builds real ReviewWorkspace
 * projections through buildWorkspace so the UI layer asserts the same
 * numbers as the pure domain and the workspace projection.
 */
import {
  buildWorkspace,
  type ReviewWorkspace,
  type WorkspaceMaturityEntry,
} from "~/models/workspace";
import type { OverrideTransition } from "~/services/maturity/override";
import { serializeMaturityDefinition } from "~/services/maturity/persistence";
import {
  associate,
  makeDefinition,
  type VectorQuestion,
} from "../../../unit/services/maturity/acceptanceVectors";
import {
  checklist,
  elevenQuestions,
  noApplicableQuestions,
  straddleQuestions,
  tenQuestions,
  wholeQuestionAssociations,
  yesNo,
} from "../../../unit/services/maturity/calculationFixtures";
import {
  makeAnswers,
  makePillars,
  makeRevision,
  makeWorkspaceOptions,
} from "../../../unit/services/maturity/workspaceFixtures";

export const REVIEW_ID = "review-1";

/**
 * Stage-path fixture (AC-036 through AC-038, AC-056 through AC-058).
 * Result: earned 5/2 over 10 = 1/4, Stage 2, display 25,
 * coverage 4/5 (provisional).
 *   Stage 1: Q1 (met), Q2 (unmet), earlier stage
 *   Stage 2: Q3-P2 (unmet), current stage
 *   Stage 3: Q3-P1 (met), later stage
 *   Stage 4: Q4 (unmet, guided), later stage with stage guidance
 *   Stage 5: Q5-P1, Q5-P2 (unanswered), later stage
 */
export const stagePathQuestions: VectorQuestion[] = [
  yesNo("Q1", "P-A", "high", "yes"),
  yesNo("Q2", "P-A", "high", "no"),
  checklist("Q3", "P-B", "medium", {
    practices: ["Q3-P1", "Q3-P2"],
    answer: { checked: ["Q3-P1"], na: [] },
  }),
  yesNo("Q4", "P-A", "critical", "no"),
  checklist("Q5", "P-B", "high", { practices: ["Q5-P1", "Q5-P2"] }),
];

export const stagePathDefinition = makeDefinition(
  stagePathQuestions,
  associate([
    { id: "Q1", stage: 1 },
    { id: "Q2", stage: 1 },
    {
      id: "Q3",
      stage: 2,
      practices: [
        { id: "Q3-P1", stage: 3 },
        { id: "Q3-P2", stage: 2 },
      ],
    },
    { id: "Q4", stage: 4 },
    { id: "Q5", stage: 5 },
  ]),
  {
    guidance: {
      stages: { 4: "Instrument the delivery pipeline." },
      questions: {},
      practices: { Q3: { "Q3-P2": "Review changes in pairs." } },
    },
  }
);

export function stagePathWorkspace(
  overrides: OverrideTransition[] = []
): ReviewWorkspace {
  return buildWorkspace(
    makeWorkspaceOptions({
      templateRevisions: [
        makeRevision(
          "rev-1",
          0,
          serializeMaturityDefinition(stagePathDefinition)
        ),
      ],
      pillars: makePillars("rev-1", stagePathQuestions),
      answers: makeAnswers(stagePathQuestions),
      overrides,
    })
  );
}

/** Full-coverage variant: every question answered → no provisional qualifier (AC-056). */
export function fullCoverageWorkspace(): ReviewWorkspace {
  const questions: VectorQuestion[] = [
    yesNo("Q1", "P-A", "medium", "yes"),
    yesNo("Q2", "P-A", "high", "no"),
  ];
  return buildWorkspace(
    makeWorkspaceOptions({
      templateRevisions: [
        makeRevision("rev-1", 0, definitionJsonFor(questions)),
      ],
      pillars: makePillars("rev-1", questions),
      answers: makeAnswers(questions),
    })
  );
}

function definitionJsonFor(questions: readonly VectorQuestion[]): string {
  return serializeMaturityDefinition(
    makeDefinition(questions, wholeQuestionAssociations(questions))
  );
}

/** AC-035 straddle vector: exact 199/250 = 79.6% displays as 80%, stays stage 4. */
export function straddleWorkspace(): ReviewWorkspace {
  const definition = makeDefinition(
    straddleQuestions,
    wholeQuestionAssociations(straddleQuestions),
    { allocations: { "Q-CL": { mode: "custom", shares: { P1: 66, P2: 34 } } } }
  );
  return buildWorkspace(
    makeWorkspaceOptions({
      templateRevisions: [
        makeRevision("rev-1", 0, serializeMaturityDefinition(definition)),
      ],
      pillars: makePillars("rev-1", straddleQuestions),
      answers: makeAnswers(straddleQuestions),
    })
  );
}

/** Two pinned Revisions — one result card each, never a combined score (AC-025). */
export function multiRevisionWorkspace(): ReviewWorkspace {
  const questionsA = [yesNo("A-Q1", "P-A", "medium", "yes")];
  const questionsB = [yesNo("B-Q1", "P-B", "medium", "no")];
  return buildWorkspace(
    makeWorkspaceOptions({
      templateRevisions: [
        makeRevision("rev-1", 0, definitionJsonFor(questionsA)),
        makeRevision("rev-2", 1, definitionJsonFor(questionsB)),
      ],
      pillars: [
        ...makePillars("rev-1", questionsA),
        ...makePillars("rev-2", questionsB),
      ],
      answers: [...makeAnswers(questionsA), ...makeAnswers(questionsB)],
    })
  );
}

/** AC-060: pinned Revision without a maturity definition. */
export function noDefinitionWorkspace(): ReviewWorkspace {
  const questions = [yesNo("A-Q1", "P-A", "medium", "yes")];
  return buildWorkspace(
    makeWorkspaceOptions({
      templateRevisions: [makeRevision("rev-1", 0, null)],
      pillars: makePillars("rev-1", questions),
      answers: makeAnswers(questions),
    })
  );
}

/** AC-042: pinned Revision over the ten-question limit. */
export function overLimitWorkspace(): ReviewWorkspace {
  return buildWorkspace(
    makeWorkspaceOptions({
      templateRevisions: [
        makeRevision("rev-1", 0, definitionJsonFor(elevenQuestions)),
      ],
      pillars: makePillars("rev-1", elevenQuestions),
      answers: makeAnswers(elevenQuestions),
    })
  );
}

/** AC-022: no applicable answered question — explicit no-result, never 0%. */
export function noResultWorkspace(
  overrides: OverrideTransition[] = []
): ReviewWorkspace {
  return buildWorkspace(
    makeWorkspaceOptions({
      templateRevisions: [
        makeRevision("rev-1", 0, definitionJsonFor(noApplicableQuestions)),
      ],
      pillars: makePillars("rev-1", noApplicableQuestions),
      answers: makeAnswers(noApplicableQuestions),
      overrides,
    })
  );
}

/** Canonical ten-question template — exercises the summarized remainder (AC-029). */
export function tenQuestionWorkspace(): ReviewWorkspace {
  return buildWorkspace(
    makeWorkspaceOptions({
      templateRevisions: [
        makeRevision("rev-1", 0, definitionJsonFor(tenQuestions)),
      ],
      pillars: makePillars("rev-1", tenQuestions),
      answers: makeAnswers(tenQuestions),
    })
  );
}

/** A current Advisor override on the stage-path fixture (AC-030, AC-031). */
export const advisorOverride: OverrideTransition = {
  id: "ovr-1",
  reviewId: REVIEW_ID,
  templateRevisionId: "rev-1",
  action: "create",
  actorId: "advisor-1",
  occurredAt: "2026-02-01T10:00:00.000Z",
  priorTransitionId: null,
  reviewedResult: { percent: 75, stage: 4 },
  explanation: "Evidence verified on site.",
  evidence: ["EV-100"],
};

export function resultEntry(
  workspace: ReviewWorkspace,
  index = 0
): Extract<WorkspaceMaturityEntry, { kind: "result" }> {
  const entry = workspace.maturity[index]!;
  if (entry.kind !== "result")
    throw new Error(`expected result, got ${entry.kind}`);
  return entry;
}
