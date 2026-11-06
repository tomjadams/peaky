import { describe, expect, it } from "vitest";
import { buildWorkspace } from "~/models/workspace";
import {
  buildFollowUpBuckets,
  describeStagePanel,
  indexStagePathQuestions,
  type StagePanel,
} from "~/services/maturity/stagePath";
import { serializeMaturityDefinition } from "~/services/maturity/persistence";
import {
  advisorOverride,
  resultEntry,
  stagePathDefinition,
  stagePathWorkspace,
} from "../../../nuxt/components/maturity/fixtures";
import {
  makeDefinition,
  associate,
  type VectorQuestion,
} from "./acceptanceVectors";
import { checklist, yesNo } from "./calculationFixtures";
import {
  makeAnswers,
  makePillars,
  makeRevision,
  makeWorkspaceOptions,
} from "./workspaceFixtures";

function bucketsFor(
  workspace: ReturnType<typeof stagePathWorkspace>,
  definition = stagePathDefinition
) {
  const entry = resultEntry(workspace);
  return buildFollowUpBuckets({
    resultStage: entry.effectiveResult.stage.stage,
    definition,
    trace: entry.trace,
    questions: indexStagePathQuestions(
      workspace.pillars.filter(
        (pillar) => pillar.templateRevisionId === entry.templateRevisionId
      )
    ),
  });
}

describe("buildFollowUpBuckets", () => {
  it("groups every explicit unmet item relative to the effective result", () => {
    const buckets = bucketsFor(stagePathWorkspace());

    expect(
      buckets.earlier.map((item) => [
        item.stage,
        item.stageName,
        item.practice.practiceId,
      ])
    ).toEqual([[1, "Not implemented", "Q2"]]);
    expect(
      buckets.current.map((item) => [
        item.stage,
        item.stageName,
        item.practice.practiceId,
      ])
    ).toEqual([[2, "Ad-hoc", "Q3-P2"]]);
    expect(
      buckets.later.map((item) => [
        item.stage,
        item.stageName,
        item.practice.practiceId,
      ])
    ).toEqual([[4, "Measured", "Q4"]]);

    expect(buckets.notAssessed.map((item) => item.practice.practiceId)).toEqual(
      ["Q5-P1", "Q5-P2"]
    );
    expect(
      [
        ...buckets.earlier,
        ...buckets.current,
        ...buckets.later,
        ...buckets.notAssessed,
      ].map((item) => item.practice.practiceId)
    ).not.toContain("Q1");
  });

  it("uses an Advisor-reviewed effective stage without changing evidence state", () => {
    const buckets = bucketsFor(stagePathWorkspace([advisorOverride]));

    expect(buckets.earlier.map((item) => item.practice.practiceId)).toEqual([
      "Q2",
      "Q3-P2",
    ]);
    expect(buckets.current.map((item) => item.practice.practiceId)).toEqual([
      "Q4",
    ]);
    expect(buckets.later).toEqual([]);
    expect(buckets.notAssessed.map((item) => item.practice.practiceId)).toEqual(
      ["Q5-P1", "Q5-P2"]
    );
  });

  it("excludes met and not-applicable evidence while keeping recorded checklist gaps", () => {
    const questions = [
      checklist("Q-CL", "P-A", "medium", {
        practices: ["P-MET", "P-NA", "P-GAP"],
        answer: { checked: ["P-MET"], na: ["P-NA"] },
      }),
      yesNo("Q-NA", "P-A", "medium", "na"),
    ];
    const definition = makeDefinition(
      questions,
      associate([
        { id: "Q-CL", stage: 2 },
        { id: "Q-NA", stage: 2 },
      ])
    );
    const workspace = buildWorkspace(
      makeWorkspaceOptions({
        templateRevisions: [
          makeRevision("rev-1", 0, serializeMaturityDefinition(definition)),
        ],
        pillars: makePillars("rev-1", questions),
        answers: makeAnswers(questions),
      })
    );
    const entry = resultEntry(workspace);
    const buckets = buildFollowUpBuckets({
      resultStage: entry.effectiveResult.stage.stage,
      definition,
      trace: entry.trace,
      questions: indexStagePathQuestions(workspace.pillars),
    });
    const visible = [
      ...buckets.earlier,
      ...buckets.current,
      ...buckets.later,
      ...buckets.notAssessed,
    ].map((item) => item.practice.practiceId);

    expect(visible).toEqual(["P-GAP"]);
  });

  it("keeps unanswered evidence available when the calculation has no result stage", () => {
    const questions: VectorQuestion[] = [
      {
        questionId: "Q-WHOLE-NA",
        pillarId: "P-A",
        severity: "medium",
        type: "checklist",
        practiceIds: ["P-ONE", "P-TWO"],
        answer: "na",
      },
      yesNo("Q-OPEN", "P-A", "medium"),
    ];
    const definition = makeDefinition(
      questions,
      associate([
        { id: "Q-WHOLE-NA", stage: 2 },
        { id: "Q-OPEN", stage: 4 },
      ])
    );
    const workspace = buildWorkspace(
      makeWorkspaceOptions({
        templateRevisions: [
          makeRevision("rev-1", 0, serializeMaturityDefinition(definition)),
        ],
        pillars: makePillars("rev-1", questions),
        answers: makeAnswers(questions),
      })
    );
    const entry = workspace.maturity[0]!;
    expect(entry.kind).toBe("no-result");
    if (entry.kind !== "no-result") return;

    const buckets = buildFollowUpBuckets({
      resultStage: null,
      definition,
      trace: { questions: entry.questions },
      questions: indexStagePathQuestions(workspace.pillars),
    });

    expect(buckets.earlier).toEqual([]);
    expect(buckets.current).toEqual([]);
    expect(buckets.later).toEqual([]);
    expect(buckets.notAssessed.map((item) => item.practice.practiceId)).toEqual(
      ["Q-OPEN"]
    );
  });

  it("projects an explicit empty checklist as gaps instead of Not assessed", () => {
    const questions = [
      checklist("Q-EMPTY", "P-A", "medium", {
        practices: ["P-ONE", "P-TWO"],
        answer: { checked: [], na: [] },
      }),
    ];
    const definition = makeDefinition(
      questions,
      associate([{ id: "Q-EMPTY", stage: 1 }])
    );
    const workspace = buildWorkspace(
      makeWorkspaceOptions({
        templateRevisions: [
          makeRevision("rev-1", 0, serializeMaturityDefinition(definition)),
        ],
        pillars: makePillars("rev-1", questions),
        answers: makeAnswers(questions),
      })
    );
    const entry = resultEntry(workspace);
    const buckets = buildFollowUpBuckets({
      resultStage: entry.effectiveResult.stage.stage,
      definition,
      trace: entry.trace,
      questions: indexStagePathQuestions(workspace.pillars),
    });

    expect(buckets.current.map((item) => item.practice.practiceId)).toEqual([
      "P-ONE",
      "P-TWO",
    ]);
    expect(buckets.notAssessed).toEqual([]);
  });

  it("does not expand hidden checklist content after a question becomes yes/no", () => {
    const questions = [yesNo("Q-RETYPED", "P-A", "medium")];
    const definition = makeDefinition(
      questions,
      associate([{ id: "Q-RETYPED", stage: 1 }])
    );
    const pillars = makePillars("rev-1", questions);
    pillars[0]!.questions[0]!.checklistItems = [
      { id: "P-STALE-ONE", order: 1, text: "Stale practice one" },
      { id: "P-STALE-TWO", order: 2, text: "Stale practice two" },
    ];
    const workspace = buildWorkspace(
      makeWorkspaceOptions({
        templateRevisions: [
          makeRevision("rev-1", 0, serializeMaturityDefinition(definition)),
        ],
        pillars,
        answers: [
          {
            questionId: "Q-RETYPED",
            answer: { checked: [], na: [] },
            updatedAt: "2026-01-02T00:00:00.000Z",
          },
        ],
      })
    );
    const entry = workspace.maturity[0]!;
    expect(entry.kind).toBe("no-result");
    if (entry.kind !== "no-result") return;
    const indexed = indexStagePathQuestions(workspace.pillars);
    const buckets = buildFollowUpBuckets({
      resultStage: null,
      definition,
      trace: { questions: entry.questions },
      questions: indexed,
    });

    expect(indexed.get("Q-RETYPED")).toMatchObject({
      type: "yes-no",
      practices: [],
    });
    expect(buckets.notAssessed.map((item) => item.practice.practiceId)).toEqual(
      ["Q-RETYPED"]
    );
  });
});

const stagePractice = (state: StagePanel["practices"][number]["state"]) => ({
  questionId: `question-${state}`,
  practiceId: `practice-${state}`,
  questionText: `Question ${state}`,
  practiceText: `Practice ${state}`,
  pillarId: "pillar-1",
  pillarName: "Reliability",
  state,
  severity: "medium" as const,
  guidance: null,
});

describe("describeStagePanel", () => {
  it("announces not-applicable evidence separately from unmet and not assessed", () => {
    const panel: StagePanel = {
      stage: 1,
      kind: "earlier",
      name: "Not implemented",
      description: "No consistent practice is in place.",
      stageGuidance: null,
      practices: [
        stagePractice("met"),
        stagePractice("unmet"),
        stagePractice("unknown"),
        stagePractice("not-applicable"),
      ],
    };

    expect(describeStagePanel(panel)).toBe(
      "Stage 1 Not implemented. 4 associated practices: 1 met, 1 unmet, 1 not assessed, 1 not applicable."
    );
  });
});
