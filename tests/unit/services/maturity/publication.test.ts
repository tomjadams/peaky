/**
 * Publication integration for the maturity definition (maturity-score/REQ-009,
 * REQ-010, REQ-017; AC-009 through AC-014, AC-040, AC-041, AC-047, AC-052).
 *
 * The template write routes stay frozen at HTTP 503 template_write_unavailable;
 * this is the domain-level publication contract they will call once the freeze
 * lifts. One validated, serialized document freezes atomically with the
 * Revision — an invalid definition yields field-addressable issues and no
 * publishable payload.
 */
import { describe, expect, it } from "vitest";
import {
  validateMaturityDefinition,
  type ScorableQuestion,
} from "~/services/maturity/definition";
import {
  preparePublicationMaturity,
  type PublicationMaturityIssue,
} from "~/services/maturity/publication";
import { buildDefaultMaturityDefinition } from "~/services/maturity/defaults";
import {
  decodeMaturityDefinition,
  serializeMaturityDefinition,
} from "~/services/maturity/persistence";
import { associate, makeDefinition } from "./acceptanceVectors";
import {
  elevenQuestions,
  wholeQuestionAssociations,
} from "./calculationFixtures";

const QUESTIONS: ScorableQuestion[] = [
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
    practiceIds: ["P1", "P2"],
  },
];

const VALID_ASSOCIATIONS = associate([
  { id: "Q-YN", stage: 1 },
  {
    id: "Q-CL",
    stage: 2,
    practices: [
      { id: "P1", stage: 2 },
      { id: "P2", stage: 3 },
    ],
  },
]);

function expectBlocked(
  result: ReturnType<typeof preparePublicationMaturity>,
  issue: PublicationMaturityIssue
): void {
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.issues).toContainEqual(expect.objectContaining(issue));
}

describe("preparePublicationMaturity", () => {
  it("publishes configured defaults when the author changed nothing (AC-009, AC-010)", () => {
    const result = preparePublicationMaturity({ questions: QUESTIONS });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.maturityDefinition).toBe(
      serializeMaturityDefinition(buildDefaultMaturityDefinition(QUESTIONS))
    );
    const decoded = decodeMaturityDefinition(result.maturityDefinition);
    expect(decoded).not.toBeNull();
    expect(validateMaturityDefinition(decoded!, QUESTIONS)).toEqual([]);
  });

  it("freezes a validated custom definition into one serialized document (REQ-009, AC-040)", () => {
    const definition = makeDefinition(QUESTIONS, VALID_ASSOCIATIONS, {
      thresholds: [25, 45, 65, 85],
      allocations: {
        "Q-CL": { mode: "custom", shares: { P1: 60, P2: 40 } },
      },
    });
    const result = preparePublicationMaturity({
      definition,
      questions: QUESTIONS,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(decodeMaturityDefinition(result.maturityDefinition)).toEqual(
      definition
    );
  });

  it("publishes an explicit no-definition state as NULL (AC-060)", () => {
    const result = preparePublicationMaturity({
      definition: null,
      questions: QUESTIONS,
    });
    expect(result).toEqual({ ok: true, maturityDefinition: null });
  });

  it("blocks invalid score ranges with field-addressable issues (AC-011, AC-012)", () => {
    const definition = makeDefinition(QUESTIONS, VALID_ASSOCIATIONS, {
      thresholds: [31, 40, 60, 80],
    });
    expectBlocked(
      preparePublicationMaturity({ definition, questions: QUESTIONS }),
      {
        code: "threshold-out-of-tolerance",
        path: "thresholds[0]",
      }
    );
  });

  it("blocks allocation totals other than exactly 100 (AC-013)", () => {
    const definition = makeDefinition(QUESTIONS, VALID_ASSOCIATIONS, {
      allocations: {
        "Q-CL": { mode: "custom", shares: { P1: 60, P2: 39 } },
      },
    });
    expectBlocked(
      preparePublicationMaturity({ definition, questions: QUESTIONS }),
      {
        code: "allocation-total",
        path: "allocations.Q-CL.shares",
      }
    );
  });

  it("blocks over-length guidance without truncating it (AC-014, AC-047)", () => {
    const overlong = "x".repeat(241);
    const definition = makeDefinition(QUESTIONS, VALID_ASSOCIATIONS, {
      guidance: { stages: {}, questions: { "Q-YN": overlong }, practices: {} },
    });
    const result = preparePublicationMaturity({
      definition,
      questions: QUESTIONS,
    });
    expectBlocked(result, {
      code: "guidance-too-long",
      path: "guidance.questions.Q-YN",
    });
    if (!result.ok) {
      // The rejected payload is never serialized — no truncation path exists.
      expect("maturityDefinition" in result).toBe(false);
    }
  });

  it("blocks unassociated questions and practices (AC-052)", () => {
    const missingQuestion = makeDefinition(
      QUESTIONS,
      associate([{ id: "Q-YN", stage: 1 }])
    );
    expectBlocked(
      preparePublicationMaturity({
        definition: missingQuestion,
        questions: QUESTIONS,
      }),
      { code: "association-missing", path: "associations.questions.Q-CL" }
    );

    const missingPractice = makeDefinition(
      QUESTIONS,
      associate([
        { id: "Q-YN", stage: 1 },
        { id: "Q-CL", stage: 2, practices: [{ id: "P1", stage: 2 }] },
      ])
    );
    expectBlocked(
      preparePublicationMaturity({
        definition: missingPractice,
        questions: QUESTIONS,
      }),
      { code: "association-missing", path: "associations.practices.Q-CL.P2" }
    );
  });

  it("independently rejects a draft with more than ten questions (AC-041)", () => {
    const definition = makeDefinition(
      elevenQuestions,
      wholeQuestionAssociations(elevenQuestions)
    );
    expectBlocked(
      preparePublicationMaturity({
        definition,
        questions: elevenQuestions,
      }),
      { code: "too-many-questions", path: "questions" }
    );
  });

  it("produces no publishable payload when validation fails (AC-040)", () => {
    const definition = makeDefinition(QUESTIONS, VALID_ASSOCIATIONS, {
      thresholds: [35, 40, 60, 80],
    });
    const result = preparePublicationMaturity({
      definition,
      questions: QUESTIONS,
    });
    // Atomicity contract: callers gate the Revision write on `ok`; a failed
    // validation carries issues only, so a Revision can never freeze with
    // template content updated but maturity missing (or vice versa).
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.length).toBeGreaterThan(0);
  });
});
