/**
 * Configured-default definition builder (maturity-score/REQ-009, REQ-010;
 * AC-010, AC-049, AC-050, AC-053): when an author retains the configured
 * defaults the persisted document still carries equal bands, explicit equal
 * shares, deterministic whole-question stage associations, and unset guidance.
 */
import { describe, expect, it } from "vitest";
import {
  validateMaturityDefinition,
  type ScorableQuestion,
} from "~/services/maturity/definition";
import {
  buildDefaultMaturityDefinition,
  scorableQuestionsFromRevision,
} from "~/services/maturity/defaults";
import { serializeMaturityDefinition } from "~/services/maturity/persistence";
import { DEFAULT_THRESHOLDS } from "~/services/maturity/stages";

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
    practiceIds: ["P1", "P2", "P3"],
  },
];

describe("buildDefaultMaturityDefinition", () => {
  it("persists the configured stage bands, explicit equal shares, and unset guidance (AC-010)", () => {
    const definition = buildDefaultMaturityDefinition(QUESTIONS);

    expect(definition.thresholds).toEqual([...DEFAULT_THRESHOLDS]);
    expect(definition.allocations).toEqual({ "Q-CL": { mode: "equal" } });
    expect(definition.guidance).toEqual({
      stages: {},
      questions: {},
      practices: {},
    });
  });

  it("associates every question deterministically in authored order (AC-050, AC-053)", () => {
    const definition = buildDefaultMaturityDefinition(QUESTIONS);

    expect(definition.associations.questions).toEqual({
      "Q-YN": 1,
      "Q-CL": 1,
    });
    expect(definition.associations.practices).toEqual({});
    expect(definition.associations.stageOrder[1]).toEqual([
      { questionId: "Q-YN" },
      { questionId: "Q-CL" },
    ]);
    for (const stage of [2, 3, 4, 5] as const) {
      expect(definition.associations.stageOrder[stage]).toEqual([]);
    }
  });

  it("presents as publishable with no validation issues (AC-049)", () => {
    const definition = buildDefaultMaturityDefinition(QUESTIONS);
    expect(validateMaturityDefinition(definition, QUESTIONS)).toEqual([]);
  });

  it("is deterministic: identical questions serialize byte-equivalently (REQ-009)", () => {
    expect(
      serializeMaturityDefinition(buildDefaultMaturityDefinition(QUESTIONS))
    ).toBe(
      serializeMaturityDefinition(buildDefaultMaturityDefinition(QUESTIONS))
    );
  });
});

describe("scorableQuestionsFromRevision", () => {
  it("extracts the scoring-unit shape from a Revision content tree", () => {
    const revision = {
      pillars: [
        {
          id: "pillar-b",
          questions: [
            {
              id: "q-2",
              type: "checklist" as const,
              riskLevel: "critical" as const,
              checklistItems: [{ id: "cli-1" }, { id: "cli-2" }],
            },
          ],
        },
        {
          id: "pillar-a",
          questions: [
            { id: "q-1", type: "yes-no" as const, riskLevel: "high" as const },
          ],
        },
      ],
    };

    expect(scorableQuestionsFromRevision(revision)).toEqual([
      {
        questionId: "q-2",
        pillarId: "pillar-b",
        severity: "critical",
        type: "checklist",
        practiceIds: ["cli-1", "cli-2"],
      },
      {
        questionId: "q-1",
        pillarId: "pillar-a",
        severity: "high",
        type: "yes-no",
        practiceIds: [],
      },
    ]);
  });

  it("treats missing question type as yes-no and missing checklist items as empty", () => {
    const revision = {
      pillars: [
        {
          id: "pillar-a",
          questions: [
            { id: "q-1", riskLevel: "medium" as const },
            {
              id: "q-2",
              type: "checklist" as const,
              riskLevel: "medium" as const,
            },
          ],
        },
      ],
    };

    expect(scorableQuestionsFromRevision(revision)).toEqual([
      {
        questionId: "q-1",
        pillarId: "pillar-a",
        severity: "medium",
        type: "yes-no",
        practiceIds: [],
      },
      {
        questionId: "q-2",
        pillarId: "pillar-a",
        severity: "medium",
        type: "checklist",
        practiceIds: [],
      },
    ]);
  });
});
