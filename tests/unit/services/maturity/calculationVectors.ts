/**
 * Calculation acceptance vectors (maturity-score/REQ-011 through REQ-015).
 * Fixtures and the vector table live here; shared builders live in
 * acceptanceVectors.ts. Split to stay within the per-file line budget.
 */
import { makeDefinition, type CalculationVector } from "./acceptanceVectors";

import {
  severityWeightsQuestions,
  yesNoQuestions,
  equalChecklistQuestions,
  customAllocationQuestions,
  partialNaQuestions,
  allNaQuestions,
  unansweredQuestions,
  noApplicableQuestions,
  boundary20Questions,
  boundary60Questions,
  boundary80Questions,
  advancedThresholdsQuestions,
  advancedHalfQuestions,
  straddleQuestions,
  tenQuestions,
  elevenQuestions,
  wholeQuestionAssociations,
  yesNo,
} from "./calculationFixtures";

export const CALCULATION_VECTORS: readonly CalculationVector[] = [
  {
    id: "severity-weights",
    cites: ["REQ-011", "AC-017"],
    definition: makeDefinition(
      severityWeightsQuestions,
      wholeQuestionAssociations(severityWeightsQuestions)
    ),
    questions: severityWeightsQuestions,
    expect: {
      kind: "result",
      result: ["0", "1"],
      stage: 1,
      displayPercent: 0,
      coverage: { answered: 3, unanswered: 0, total: 3 },
      questionWeights: { "Q-MED": 1, "Q-HIGH": 2, "Q-CRIT": 3 },
      questionPoints: {
        "Q-MED": { earned: ["0", "1"], available: ["1", "1"] },
        "Q-HIGH": { earned: ["0", "1"], available: ["2", "1"] },
        "Q-CRIT": { earned: ["0", "1"], available: ["3", "1"] },
      },
    },
  },
  {
    id: "yes-no-contributes",
    cites: ["REQ-011", "AC-015", "AC-017", "AC-018"],
    definition: makeDefinition(
      yesNoQuestions,
      wholeQuestionAssociations(yesNoQuestions)
    ),
    questions: yesNoQuestions,
    expect: {
      kind: "result",
      result: ["2", "3"],
      stage: 4,
      displayPercent: 67,
      coverage: { answered: 3, unanswered: 0, total: 3 },
      questionPoints: {
        "Q-YES-CRIT": { earned: ["3", "1"], available: ["3", "1"] },
        "Q-NO-HIGH": { earned: ["0", "1"], available: ["2", "1"] },
        "Q-YES-MED": { earned: ["1", "1"], available: ["1", "1"] },
      },
    },
  },
  {
    id: "equal-checklist-allocation",
    cites: ["REQ-011", "AC-016", "AC-055"],
    definition: makeDefinition(
      equalChecklistQuestions,
      wholeQuestionAssociations(equalChecklistQuestions)
    ),
    questions: equalChecklistQuestions,
    expect: {
      kind: "result",
      result: ["2", "3"],
      stage: 4,
      displayPercent: 67,
      coverage: { answered: 1, unanswered: 0, total: 1 },
      questionPoints: { "Q-CL": { earned: ["4", "3"], available: ["2", "1"] } },
    },
  },
  {
    id: "custom-checklist-allocation",
    cites: ["REQ-010", "REQ-011", "AC-013", "AC-016"],
    definition: makeDefinition(
      customAllocationQuestions,
      wholeQuestionAssociations(customAllocationQuestions),
      {
        allocations: {
          "Q-CL": { mode: "custom", shares: { P1: 50, P2: 30, P3: 20 } },
        },
      }
    ),
    questions: customAllocationQuestions,
    expect: {
      kind: "result",
      result: ["1", "2"],
      stage: 3,
      displayPercent: 50,
      coverage: { answered: 1, unanswered: 0, total: 1 },
      questionPoints: { "Q-CL": { earned: ["3", "2"], available: ["3", "1"] } },
    },
  },
  {
    id: "partial-na-removes-exact-share",
    cites: ["REQ-012", "AC-020"],
    definition: makeDefinition(
      partialNaQuestions,
      wholeQuestionAssociations(partialNaQuestions)
    ),
    questions: partialNaQuestions,
    expect: {
      kind: "result",
      result: ["2", "3"],
      stage: 4,
      displayPercent: 67,
      coverage: { answered: 1, unanswered: 0, total: 1 },
      questionPoints: {
        "Q-CL": { earned: ["1", "2"], available: ["3", "4"] },
      },
    },
  },
  {
    id: "all-na-counts-answered",
    cites: ["REQ-012", "AC-021"],
    definition: makeDefinition(
      allNaQuestions,
      wholeQuestionAssociations(allNaQuestions)
    ),
    questions: allNaQuestions,
    expect: {
      kind: "result",
      result: ["1", "1"],
      stage: 5,
      displayPercent: 100,
      coverage: { answered: 2, unanswered: 0, total: 2 },
      questionPoints: {
        "Q-CL": { earned: ["0", "1"], available: ["0", "1"] },
        "Q-YN": { earned: ["1", "1"], available: ["1", "1"] },
      },
    },
  },
  {
    id: "unanswered-reduces-coverage",
    cites: ["REQ-012", "AC-019"],
    definition: makeDefinition(
      unansweredQuestions,
      wholeQuestionAssociations(unansweredQuestions)
    ),
    questions: unansweredQuestions,
    expect: {
      kind: "result",
      result: ["1", "2"],
      stage: 3,
      displayPercent: 50,
      coverage: { answered: 1, unanswered: 1, total: 2 },
      questionPoints: {
        "Q-YES": { earned: ["1", "1"], available: ["1", "1"] },
        "Q-OPEN": { earned: ["0", "1"], available: ["1", "1"] },
      },
    },
  },
  {
    id: "no-applicable-result",
    cites: ["REQ-012", "AC-022"],
    definition: makeDefinition(
      noApplicableQuestions,
      wholeQuestionAssociations(noApplicableQuestions)
    ),
    questions: noApplicableQuestions,
    expect: {
      kind: "no-result",
      coverage: { answered: 1, unanswered: 1, total: 2 },
    },
  },
  {
    id: "exact-boundary-20",
    cites: ["REQ-013", "AC-023", "AC-055"],
    definition: makeDefinition(
      boundary20Questions,
      wholeQuestionAssociations(boundary20Questions)
    ),
    questions: boundary20Questions,
    expect: {
      kind: "result",
      result: ["1", "5"],
      stage: 2,
      displayPercent: 20,
      coverage: { answered: 5, unanswered: 0, total: 5 },
      questionPoints: {
        "Q-1": { earned: ["1", "1"], available: ["1", "1"] },
        "Q-X1": { earned: ["0", "1"], available: ["1", "1"] },
        "Q-X2": { earned: ["0", "1"], available: ["1", "1"] },
        "Q-X3": { earned: ["0", "1"], available: ["1", "1"] },
        "Q-X4": { earned: ["0", "1"], available: ["1", "1"] },
      },
    },
  },
  {
    id: "exact-boundary-60",
    cites: ["REQ-013", "AC-023"],
    definition: makeDefinition(
      boundary60Questions,
      wholeQuestionAssociations(boundary60Questions)
    ),
    questions: boundary60Questions,
    expect: {
      kind: "result",
      result: ["3", "5"],
      stage: 4,
      displayPercent: 60,
      coverage: { answered: 2, unanswered: 0, total: 2 },
      questionPoints: {
        "Q-1": { earned: ["3", "1"], available: ["3", "1"] },
        "Q-2": { earned: ["0", "1"], available: ["2", "1"] },
      },
    },
  },
  {
    id: "exact-boundary-80",
    cites: ["REQ-013", "AC-023"],
    definition: makeDefinition(
      boundary80Questions,
      wholeQuestionAssociations(boundary80Questions)
    ),
    questions: boundary80Questions,
    expect: {
      kind: "result",
      result: ["4", "5"],
      stage: 5,
      displayPercent: 80,
      coverage: { answered: 3, unanswered: 0, total: 3 },
      questionPoints: {
        "Q-1": { earned: ["2", "1"], available: ["2", "1"] },
        "Q-2": { earned: ["2", "1"], available: ["2", "1"] },
        "Q-3": { earned: ["0", "1"], available: ["1", "1"] },
      },
    },
  },
  {
    id: "advanced-thresholds-boundary",
    cites: ["REQ-010", "REQ-013", "AC-012", "AC-024"],
    definition: makeDefinition(
      advancedThresholdsQuestions,
      wholeQuestionAssociations(advancedThresholdsQuestions),
      {
        thresholds: [25, 45, 65, 85],
      }
    ),
    questions: advancedThresholdsQuestions,
    expect: {
      kind: "result",
      result: ["1", "4"],
      stage: 2,
      displayPercent: 25,
      coverage: { answered: 2, unanswered: 0, total: 2 },
      questionPoints: {
        "Q-1": { earned: ["1", "1"], available: ["1", "1"] },
        "Q-2": { earned: ["0", "1"], available: ["3", "1"] },
      },
    },
  },
  {
    id: "advanced-thresholds-midband",
    cites: ["REQ-010", "REQ-013", "AC-012"],
    definition: makeDefinition(
      advancedHalfQuestions,
      wholeQuestionAssociations(advancedHalfQuestions),
      {
        thresholds: [25, 45, 65, 85],
      }
    ),
    questions: advancedHalfQuestions,
    expect: {
      kind: "result",
      result: ["1", "2"],
      stage: 3,
      displayPercent: 50,
      coverage: { answered: 2, unanswered: 0, total: 2 },
      questionPoints: {
        "Q-1": { earned: ["1", "1"], available: ["1", "1"] },
        "Q-2": { earned: ["0", "1"], available: ["1", "1"] },
      },
    },
  },
  {
    id: "display-rounding-never-moves-stage",
    cites: ["REQ-013", "AC-024", "AC-035"],
    definition: makeDefinition(
      straddleQuestions,
      wholeQuestionAssociations(straddleQuestions),
      {
        allocations: { "Q-CL": { mode: "custom", shares: { P1: 66, P2: 34 } } },
      }
    ),
    questions: straddleQuestions,
    expect: {
      kind: "result",
      result: ["199", "250"],
      stage: 4,
      displayPercent: 80,
      coverage: { answered: 2, unanswered: 0, total: 2 },
      questionPoints: {
        "Q-CL": { earned: ["99", "50"], available: ["3", "1"] },
        "Q-YN": { earned: ["2", "1"], available: ["2", "1"] },
      },
      boundaryStraddle: { boundary: 80 },
    },
  },
  {
    id: "canonical-ten-question-template",
    cites: [
      "REQ-011",
      "REQ-012",
      "REQ-013",
      "REQ-014",
      "REQ-015",
      "AC-018",
      "AC-026",
    ],
    definition: makeDefinition(
      tenQuestions,
      wholeQuestionAssociations(tenQuestions),
      {
        allocations: {
          KQ2: { mode: "equal" },
          KQ4: { mode: "equal" },
          KQ6: { mode: "custom", shares: { P1: 50, P2: 25, P3: 25 } },
          KQ8: { mode: "equal" },
          KQ10: { mode: "equal" },
        },
      }
    ),
    questions: tenQuestions,
    expect: {
      kind: "result",
      // 17/2 earned points over 31/2 available = 17/31, about 54.8%.
      result: ["17", "31"],
      stage: 3,
      displayPercent: 55,
      coverage: { answered: 9, unanswered: 1, total: 10 },
      questionPoints: {
        KQ1: { earned: ["3", "1"], available: ["3", "1"] },
        KQ2: { earned: ["1", "1"], available: ["3", "2"] },
        KQ3: { earned: ["0", "1"], available: ["1", "1"] },
        KQ4: { earned: ["1", "1"], available: ["1", "1"] },
        KQ5: { earned: ["0", "1"], available: ["2", "1"] },
        KQ6: { earned: ["3", "2"], available: ["3", "1"] },
        KQ7: { earned: ["0", "1"], available: ["0", "1"] },
        KQ8: { earned: ["0", "1"], available: ["2", "1"] },
        KQ9: { earned: ["1", "1"], available: ["1", "1"] },
        KQ10: { earned: ["1", "1"], available: ["1", "1"] },
      },
      pillars: {
        "P-A": { result: ["10", "17"], stage: 3, answered: 4, unanswered: 1 },
        "P-B": { result: ["1", "2"], stage: 3, answered: 5, unanswered: 0 },
      },
    },
  },
  {
    id: "eleven-question-configuration-error",
    cites: ["REQ-014", "AC-042"],
    definition: makeDefinition(
      elevenQuestions,
      wholeQuestionAssociations(elevenQuestions)
    ),
    questions: elevenQuestions,
    expect: { kind: "configuration-error", questionCount: 11 },
  },
  {
    id: "smallest-single-question",
    cites: ["REQ-011", "AC-015"],
    definition: makeDefinition(
      [yesNo("Q-1", "P-A", "medium", "yes")],
      wholeQuestionAssociations([yesNo("Q-1", "P-A", "medium", "yes")])
    ),
    questions: [yesNo("Q-1", "P-A", "medium", "yes")],
    expect: {
      kind: "result",
      result: ["1", "1"],
      stage: 5,
      displayPercent: 100,
      coverage: { answered: 1, unanswered: 0, total: 1 },
      questionPoints: { "Q-1": { earned: ["1", "1"], available: ["1", "1"] } },
    },
  },
];
