/**
 * Definition-validation acceptance vectors (maturity-score/REQ-010, REQ-017).
 * Split from acceptanceVectors.ts to stay within the repo's per-file line
 * budget; shares the same fixture helpers so every layer asserts one contract.
 */
import type { ScorableQuestion } from "~/services/maturity/definition";
import {
  associate,
  makeDefinition,
  type DefinitionVector,
} from "./acceptanceVectors";
import {
  elevenQuestions,
  wholeQuestionAssociations,
} from "./calculationFixtures";

const twoChecklistQuestions: ScorableQuestion[] = [
  {
    questionId: "Q-CL",
    pillarId: "P-A",
    severity: "high",
    type: "checklist",
    practiceIds: ["P1", "P2"],
  },
  {
    questionId: "Q-YN",
    pillarId: "P-A",
    severity: "medium",
    type: "yes-no",
    practiceIds: [],
  },
];

const validAssociations = associate([
  {
    id: "Q-CL",
    stage: 2,
    practices: [
      { id: "P1", stage: 2 },
      { id: "P2", stage: 3 },
    ],
  },
  { id: "Q-YN", stage: 1 },
]);

const fullDefaultQuestions: ScorableQuestion[] = [
  {
    questionId: "Q-YN",
    pillarId: "P-A",
    severity: "medium",
    type: "yes-no",
    practiceIds: [],
  },
  {
    questionId: "Q-CL",
    pillarId: "P-A",
    severity: "high",
    type: "checklist",
    practiceIds: ["P1", "P2", "P3"],
  },
];
export const DEFINITION_VECTORS: readonly DefinitionVector[] = [
  {
    id: "configured-defaults-are-valid",
    cites: ["REQ-009", "REQ-010", "AC-010", "AC-049"],
    definition: makeDefinition(
      fullDefaultQuestions,
      associate([
        { id: "Q-YN", stage: 1 },
        { id: "Q-CL", stage: 2 },
      ])
    ),
    questions: fullDefaultQuestions,
    expect: { ok: true },
  },
  {
    id: "threshold-beyond-tolerance",
    cites: ["REQ-010", "AC-012"],
    definition: makeDefinition(
      fullDefaultQuestions,
      associate([
        { id: "Q-YN", stage: 1 },
        { id: "Q-CL", stage: 2 },
      ]),
      {
        thresholds: [31, 40, 60, 80],
      }
    ),
    questions: fullDefaultQuestions,
    expect: {
      ok: false,
      issues: [{ code: "threshold-out-of-tolerance", path: "thresholds[0]" }],
    },
  },
  {
    id: "threshold-at-tolerance-edge-is-valid",
    cites: ["REQ-010", "AC-012"],
    definition: makeDefinition(
      fullDefaultQuestions,
      associate([
        { id: "Q-YN", stage: 1 },
        { id: "Q-CL", stage: 2 },
      ]),
      {
        thresholds: [30, 50, 70, 90],
      }
    ),
    questions: fullDefaultQuestions,
    expect: { ok: true },
  },
  {
    id: "stage-narrower-than-five-points",
    cites: ["REQ-010", "AC-012"],
    definition: makeDefinition(
      fullDefaultQuestions,
      associate([
        { id: "Q-YN", stage: 1 },
        { id: "Q-CL", stage: 2 },
      ]),
      {
        thresholds: [25, 29, 60, 80],
      }
    ),
    questions: fullDefaultQuestions,
    expect: {
      ok: false,
      issues: [{ code: "stage-too-narrow", path: "thresholds[1]" }],
    },
  },
  {
    id: "custom-allocation-must-total-100",
    cites: ["REQ-010", "AC-013"],
    definition: makeDefinition(twoChecklistQuestions, validAssociations, {
      allocations: { "Q-CL": { mode: "custom", shares: { P1: 60, P2: 39 } } },
    }),
    questions: twoChecklistQuestions,
    expect: {
      ok: false,
      issues: [{ code: "allocation-total", path: "allocations.Q-CL.shares" }],
    },
  },
  {
    id: "custom-allocation-rejects-zero-share",
    cites: ["REQ-010", "AC-013"],
    definition: makeDefinition(twoChecklistQuestions, validAssociations, {
      allocations: { "Q-CL": { mode: "custom", shares: { P1: 100, P2: 0 } } },
    }),
    questions: twoChecklistQuestions,
    expect: {
      ok: false,
      issues: [
        {
          code: "allocation-share-zero",
          path: "allocations.Q-CL.shares.P2",
        },
      ],
    },
  },
  {
    id: "custom-allocation-covers-every-practice",
    cites: ["REQ-010", "AC-013"],
    definition: makeDefinition(twoChecklistQuestions, validAssociations, {
      allocations: { "Q-CL": { mode: "custom", shares: { P1: 100 } } },
    }),
    questions: twoChecklistQuestions,
    expect: {
      ok: false,
      issues: [
        {
          code: "allocation-missing-practice",
          path: "allocations.Q-CL.shares.P2",
        },
      ],
    },
  },
  {
    id: "custom-allocation-rejects-unknown-practice",
    cites: ["REQ-010", "AC-013"],
    definition: makeDefinition(twoChecklistQuestions, validAssociations, {
      allocations: {
        "Q-CL": { mode: "custom", shares: { P1: 50, P2: 40, PX: 10 } },
      },
    }),
    questions: twoChecklistQuestions,
    expect: {
      ok: false,
      issues: [
        {
          code: "allocation-unknown-practice",
          path: "allocations.Q-CL.shares.PX",
        },
      ],
    },
  },
  {
    id: "guidance-length-is-bounded",
    cites: ["REQ-010", "AC-047"],
    definition: makeDefinition(
      fullDefaultQuestions,
      associate([
        { id: "Q-YN", stage: 1 },
        { id: "Q-CL", stage: 2 },
      ]),
      {
        guidance: {
          stages: { 1: "x".repeat(241) },
          questions: {},
          practices: {},
        },
      }
    ),
    questions: fullDefaultQuestions,
    expect: {
      ok: false,
      issues: [{ code: "guidance-too-long", path: "guidance.stages.1" }],
    },
  },
  {
    id: "multibyte-guidance-at-limit-is-valid",
    cites: ["REQ-010", "AC-047"],
    definition: makeDefinition(
      fullDefaultQuestions,
      associate([
        { id: "Q-YN", stage: 1 },
        { id: "Q-CL", stage: 2 },
      ]),
      {
        guidance: {
          stages: {},
          questions: { "Q-YN": "é".repeat(240) },
          practices: {},
        },
      }
    ),
    questions: fullDefaultQuestions,
    expect: { ok: true },
  },
  {
    id: "unassociated-question-blocks-publication",
    cites: ["REQ-017", "AC-050", "AC-052"],
    definition: makeDefinition(
      fullDefaultQuestions,
      associate([{ id: "Q-YN", stage: 1 }])
    ),
    questions: fullDefaultQuestions,
    expect: {
      ok: false,
      issues: [
        { code: "association-missing", path: "associations.questions.Q-CL" },
      ],
    },
  },
  {
    id: "partially-associated-checklist-blocks-publication",
    cites: ["REQ-017", "AC-050", "AC-052"],
    definition: makeDefinition(
      twoChecklistQuestions,
      associate([
        { id: "Q-CL", stage: 2, practices: [{ id: "P1", stage: 2 }] },
        { id: "Q-YN", stage: 1 },
      ])
    ),
    questions: twoChecklistQuestions,
    expect: {
      ok: false,
      issues: [
        { code: "association-missing", path: "associations.practices.Q-CL.P2" },
      ],
    },
  },
  {
    id: "whole-question-plus-practice-association-conflicts",
    cites: ["REQ-017", "AC-050"],
    definition: (() => {
      const base = associate([
        {
          id: "Q-CL",
          stage: 2,
          practices: [
            { id: "P1", stage: 2 },
            { id: "P2", stage: 3 },
          ],
        },
        { id: "Q-YN", stage: 1 },
      ]);
      return makeDefinition(twoChecklistQuestions, {
        ...base,
        questions: { ...base.questions, "Q-CL": 4 },
      });
    })(),
    questions: twoChecklistQuestions,
    expect: {
      ok: false,
      issues: [
        { code: "association-conflict", path: "associations.questions.Q-CL" },
      ],
    },
  },
  {
    id: "per-practice-association-is-valid",
    cites: ["REQ-017", "AC-050", "AC-051", "AC-053"],
    definition: makeDefinition(twoChecklistQuestions, validAssociations),
    questions: twoChecklistQuestions,
    expect: { ok: true },
  },
  {
    id: "eleventh-question-cannot-publish",
    cites: ["REQ-010", "AC-041"],
    definition: makeDefinition(
      elevenQuestions,
      wholeQuestionAssociations(elevenQuestions)
    ),
    questions: elevenQuestions,
    expect: {
      ok: false,
      issues: [{ code: "too-many-questions", path: "questions" }],
    },
  },
];
