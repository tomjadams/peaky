/**
 * Per-Revision maturity in the flat review workspace:
 * reviews/REQ-006 (AC-018, AC-019, AC-029, AC-030, AC-031);
 * maturity-score/REQ-014, REQ-015 (AC-025, AC-039, AC-042, AC-060).
 *
 * The workspace keeps its shipped flat shape — Pillars and Questions carry
 * their own templateRevisionId — and gains one maturity entry per pinned
 * Revision beside templateRevisions[]/pillars[]. Entries derive purely from
 * workspace data; nothing is persisted.
 */
import { describe, expect, it } from "vitest";
import { buildWorkspace } from "~/models/workspace";
import type { OverrideTransition } from "~/services/maturity/override";
import { serializeTrace } from "~/services/maturity/calculate";
import { serializeMaturityDefinition } from "~/services/maturity/persistence";
import {
  deriveWorkspaceMaturity,
  workspaceAnswerToValue,
} from "~/services/maturity/workspace";
import { CALCULATION_VECTORS } from "./calculationVectors";
import { elevenQuestions, tenQuestions, yesNo } from "./calculationFixtures";
import {
  definitionJson,
  makeAnswers,
  makePillars,
  makeRevision,
  makeWorkspaceOptions,
} from "./workspaceFixtures";

const canonical = CALCULATION_VECTORS.find(
  (vector) => vector.id === "canonical-ten-question-template"
)!;
// The canonical vector pins custom KQ6 allocations; serialize its own
// definition rather than a configured-default one.
const canonicalDefinitionJson = serializeMaturityDefinition(
  canonical.definition
);

function revisionQuestions(prefix: string) {
  return [
    yesNo(`${prefix}-Q1`, `P-${prefix}`, "high", "yes"),
    yesNo(`${prefix}-Q2`, `P-${prefix}`, "medium", "no"),
  ];
}

describe("Revision integrity in the flat workspace (reviews/REQ-006; AC-018, AC-029)", () => {
  it("keeps every Pillar and Question on its Revision for a one-Revision Review (AC-018)", () => {
    const questions = revisionQuestions("A");
    const workspace = buildWorkspace(
      makeWorkspaceOptions({
        templateRevisions: [
          makeRevision("rev-1", 0, definitionJson(questions)),
        ],
        pillars: makePillars("rev-1", questions),
        answers: makeAnswers(questions),
      })
    );

    expect(
      workspace.pillars.every((pillar) => pillar.templateRevisionId === "rev-1")
    ).toBe(true);
    expect(
      workspace.pillars
        .flatMap((pillar) => pillar.questions)
        .every((question) => question.templateRevisionId === "rev-1")
    ).toBe(true);
    expect(workspace.maturity.map((entry) => entry.templateRevisionId)).toEqual(
      ["rev-1"]
    );
  });

  it("does not collapse Questions onto the first Revision of a two-Revision Review (AC-029)", () => {
    const questionsA = revisionQuestions("A");
    const questionsB = revisionQuestions("B");
    const workspace = buildWorkspace(
      makeWorkspaceOptions({
        templateRevisions: [
          makeRevision("rev-1", 0, definitionJson(questionsA)),
          makeRevision("rev-2", 1, definitionJson(questionsB)),
        ],
        pillars: [
          ...makePillars("rev-1", questionsA),
          ...makePillars("rev-2", questionsB),
        ],
        answers: [...makeAnswers(questionsA), ...makeAnswers(questionsB)],
      })
    );

    const allQuestions = workspace.pillars.flatMap(
      (pillar) => pillar.questions
    );
    expect(
      allQuestions.filter((q) => q.templateRevisionId === "rev-1")
    ).toHaveLength(2);
    expect(
      allQuestions.filter((q) => q.templateRevisionId === "rev-2")
    ).toHaveLength(2);
    expect(
      allQuestions
        .filter((q) => q.id.startsWith("B-"))
        .every((q) => q.templateRevisionId === "rev-2")
    ).toBe(true);
    expect(workspace.maturity.map((entry) => entry.templateRevisionId)).toEqual(
      ["rev-1", "rev-2"]
    );
  });

  it("does not collapse Questions onto the first Revision of a three-Revision Review (AC-029)", () => {
    const questionsA = revisionQuestions("A");
    const questionsB = revisionQuestions("B");
    const questionsC = revisionQuestions("C");
    const workspace = buildWorkspace(
      makeWorkspaceOptions({
        templateRevisions: [
          makeRevision("rev-1", 0, definitionJson(questionsA)),
          makeRevision("rev-2", 1, definitionJson(questionsB)),
          makeRevision("rev-3", 2, definitionJson(questionsC)),
        ],
        pillars: [
          ...makePillars("rev-1", questionsA),
          ...makePillars("rev-2", questionsB),
          ...makePillars("rev-3", questionsC),
        ],
        answers: [
          ...makeAnswers(questionsA),
          ...makeAnswers(questionsB),
          ...makeAnswers(questionsC),
        ],
      })
    );

    const allQuestions = workspace.pillars.flatMap(
      (pillar) => pillar.questions
    );
    expect(allQuestions).toHaveLength(6);
    for (const [revisionId, prefix] of [
      ["rev-1", "A-"],
      ["rev-2", "B-"],
      ["rev-3", "C-"],
    ] as const) {
      const owned = allQuestions.filter((q) => q.id.startsWith(prefix));
      expect(owned).toHaveLength(2);
      expect(owned.every((q) => q.templateRevisionId === revisionId)).toBe(
        true
      );
    }
    expect(workspace.maturity.map((entry) => entry.templateRevisionId)).toEqual(
      ["rev-1", "rev-2", "rev-3"]
    );
  });

  it("orders maturity entries by selection position, not array order (AC-025)", () => {
    const questionsA = revisionQuestions("A");
    const questionsB = revisionQuestions("B");
    const entries = deriveWorkspaceMaturity({
      templateRevisions: [
        makeRevision("rev-a", 1, definitionJson(questionsA)),
        makeRevision("rev-b", 0, definitionJson(questionsB)),
      ],
      pillars: [
        ...makePillars("rev-a", questionsA),
        ...makePillars("rev-b", questionsB),
      ],
      answers: [...makeAnswers(questionsA), ...makeAnswers(questionsB)],
    });

    expect(entries.map((entry) => entry.templateRevisionId)).toEqual([
      "rev-b",
      "rev-a",
    ]);
  });
});

describe("per-Revision maturity collection (reviews/AC-030; maturity-score/REQ-014, REQ-015)", () => {
  it("derives the canonical ten-question result from workspace data (AC-025 through AC-029)", () => {
    const expected = canonical.expect;
    if (expected.kind !== "result") throw new Error("fixture drift");
    const workspace = buildWorkspace(
      makeWorkspaceOptions({
        templateRevisions: [makeRevision("rev-1", 0, canonicalDefinitionJson)],
        pillars: makePillars("rev-1", tenQuestions),
        answers: makeAnswers(tenQuestions),
      })
    );

    const entry = workspace.maturity[0]!;
    expect(entry.kind).toBe("result");
    if (entry.kind !== "result") return;
    expect(entry.trace.templateRevisionId).toBe("rev-1");
    expect(entry.trace.result).toEqual({
      numerator: expected.result[0],
      denominator: expected.result[1],
    });
    expect(entry.coverage).toEqual(expected.coverage);
    // AC-026: pillar breakdown shows percentage, stage, and coverage.
    const pillarA = entry.pillars.find((row) => row.pillarId === "P-A")!;
    expect(pillarA.displayPercent).toBe(59);
    expect(pillarA.stage).toBe(3);
    expect(pillarA.unanswered).toBe(1);
    const pillarB = entry.pillars.find((row) => row.pillarId === "P-B")!;
    expect(pillarB.displayPercent).toBe(50);
    expect(pillarB.stage).toBe(3);
  });

  it("resolves the effective result to the calculated result when no override exists (AC-030)", () => {
    const workspace = buildWorkspace(
      makeWorkspaceOptions({
        templateRevisions: [makeRevision("rev-1", 0, canonicalDefinitionJson)],
        pillars: makePillars("rev-1", tenQuestions),
        answers: makeAnswers(tenQuestions),
      })
    );

    const entry = workspace.maturity[0]!;
    if (entry.kind !== "result") throw new Error("expected a result entry");
    expect(entry.effectiveResult.source).toBe("calculated");
    expect(entry.effectiveResult.override).toBeNull();
    expect(entry.effectiveResult.result).toEqual(entry.trace.result);
    expect(entry.effectiveResult.displayPercent).toBe(55);
    expect(entry.effectiveResult.stage.stage).toBe(3);
    expect(entry.overrideHistory).toEqual([]);
  });

  it("returns the explicit no-definition variant, never a 0% result (AC-060)", () => {
    const questions = revisionQuestions("A");
    const workspace = buildWorkspace(
      makeWorkspaceOptions({
        templateRevisions: [makeRevision("rev-1", 0, null)],
        pillars: makePillars("rev-1", questions),
        answers: makeAnswers(questions),
      })
    );

    const entry = workspace.maturity[0]!;
    expect(entry).toEqual({
      kind: "no-definition",
      templateRevisionId: "rev-1",
    });
    expect("trace" in entry).toBe(false);
    expect("effectiveResult" in entry).toBe(false);
  });

  it("returns the no-result variant when no applicable question is answered (AC-022)", () => {
    const questions = [
      yesNo("A-Q1", "P-A", "medium", "na"),
      yesNo("A-Q2", "P-A", "medium"),
    ];
    const workspace = buildWorkspace(
      makeWorkspaceOptions({
        templateRevisions: [
          makeRevision("rev-1", 0, definitionJson(questions)),
        ],
        pillars: makePillars("rev-1", questions),
        answers: makeAnswers(questions),
      })
    );

    const entry = workspace.maturity[0]!;
    expect(entry.kind).toBe("no-result");
    if (entry.kind !== "no-result") return;
    expect(entry.reason).toBe("no-scored-applicable-answer");
    expect(entry.coverage).toEqual({ answered: 1, unanswered: 1, total: 2 });
    expect(entry.effectiveResult).toBeNull();
  });

  it("derives results on read from current answers; nothing is persisted (REQ-014)", () => {
    const answered = [yesNo("A-Q1", "P-A", "medium", "yes")];
    const open = [yesNo("A-Q1", "P-A", "medium")];
    const base = {
      templateRevisions: [makeRevision("rev-1", 0, definitionJson(answered))],
      pillars: makePillars("rev-1", answered),
    };

    const answeredWorkspace = buildWorkspace(
      makeWorkspaceOptions({ ...base, answers: makeAnswers(answered) })
    );
    const openWorkspace = buildWorkspace(
      makeWorkspaceOptions({ ...base, answers: makeAnswers(open) })
    );

    const answeredEntry = answeredWorkspace.maturity[0]!;
    if (answeredEntry.kind !== "result") throw new Error("expected result");
    expect(answeredEntry.effectiveResult.displayPercent).toBe(100);
    expect(openWorkspace.maturity[0]!.kind).toBe("no-result");
  });
});

describe("Advisor override resolution (maturity-score/REQ-014, REQ-016; AC-027, AC-030, AC-031)", () => {
  const overrideCreated: OverrideTransition = {
    id: "ovr-1",
    reviewId: "review-1",
    templateRevisionId: "rev-1",
    action: "create",
    actorId: "actor-advisor-1",
    occurredAt: "2026-09-01T10:00:00.000Z",
    priorTransitionId: null,
    reviewedResult: { percent: 85, stage: 5 },
    explanation: "Reviewed on evidence call.",
    evidence: ["evidence:interview-1"],
  };

  function workspaceWithOverrides(overrides: OverrideTransition[]) {
    return buildWorkspace(
      makeWorkspaceOptions({
        templateRevisions: [makeRevision("rev-1", 0, canonicalDefinitionJson)],
        pillars: makePillars("rev-1", tenQuestions),
        answers: makeAnswers(tenQuestions),
        overrides,
      })
    );
  }

  it("projects the reviewed result as effective with full provenance (AC-030)", () => {
    const workspace = workspaceWithOverrides([overrideCreated]);
    const entry = workspace.maturity[0]!;
    if (entry.kind !== "result") throw new Error("expected a result entry");

    const effective = entry.effectiveResult;
    expect(effective.source).toBe("override");
    if (effective.source !== "override") throw new Error("expected override");
    expect(effective.displayPercent).toBe(85);
    expect(effective.stage.stage).toBe(5);
    expect(effective.stage.name).toBe("Optimized");
    // Provenance: actor, explanation, evidence, and time remain available.
    expect(effective.override).toEqual({
      transitionId: "ovr-1",
      actorId: "actor-advisor-1",
      explanation: "Reviewed on evidence call.",
      evidence: ["evidence:interview-1"],
      occurredAt: "2026-09-01T10:00:00.000Z",
    });
    // The calculated result is retained alongside (AC-030, AC-031).
    const expected = canonical.expect;
    if (expected.kind !== "result") throw new Error("fixture drift");
    expect(entry.trace.result).toEqual({
      numerator: String(expected.result[0]),
      denominator: String(expected.result[1]),
    });
    expect(entry.overrideHistory).toEqual([overrideCreated]);
  });

  it("never lets an override alter the calculation trace (REQ-016)", () => {
    const plain = workspaceWithOverrides([]);
    const overridden = workspaceWithOverrides([overrideCreated]);
    const plainEntry = plain.maturity[0]!;
    const overriddenEntry = overridden.maturity[0]!;
    if (plainEntry.kind !== "result" || overriddenEntry.kind !== "result") {
      throw new Error("expected result entries");
    }
    expect(serializeTrace(overriddenEntry.trace)).toBe(
      serializeTrace(plainEntry.trace)
    );
  });

  it("resolves a revoked override back to the calculated result, keeping history (AC-031)", () => {
    const revoked: OverrideTransition = {
      ...overrideCreated,
      id: "ovr-2",
      action: "revoke",
      occurredAt: "2026-09-02T10:00:00.000Z",
      priorTransitionId: "ovr-1",
      reviewedResult: null,
      explanation: "Evidence no longer stands.",
      evidence: [],
    };
    const workspace = workspaceWithOverrides([overrideCreated, revoked]);
    const entry = workspace.maturity[0]!;
    if (entry.kind !== "result") throw new Error("expected a result entry");

    expect(entry.effectiveResult.source).toBe("calculated");
    expect(entry.effectiveResult.override).toBeNull();
    expect(entry.effectiveResult.displayPercent).toBe(55);
    // The full append-only history stays available to every consumer.
    expect(entry.overrideHistory.map((t) => t.id)).toEqual(["ovr-1", "ovr-2"]);
  });

  it("scopes overrides by exact templateRevisionId — no sibling leakage (AC-031)", () => {
    const questionsB = revisionQuestions("B");
    const workspace = buildWorkspace(
      makeWorkspaceOptions({
        templateRevisions: [
          makeRevision("rev-1", 0, canonicalDefinitionJson),
          makeRevision("rev-2", 1, definitionJson(questionsB)),
        ],
        pillars: [
          ...makePillars("rev-1", tenQuestions),
          ...makePillars("rev-2", questionsB),
        ],
        answers: [...makeAnswers(tenQuestions), ...makeAnswers(questionsB)],
        overrides: [overrideCreated],
      })
    );

    const first = workspace.maturity[0]!;
    const second = workspace.maturity[1]!;
    if (first.kind !== "result" || second.kind !== "result") {
      throw new Error("expected result entries");
    }
    expect(first.effectiveResult.source).toBe("override");
    expect(second.effectiveResult.source).toBe("calculated");
    expect(second.overrideHistory).toEqual([]);
  });
});

describe("answer mapping (maturity-score/REQ-011, REQ-012)", () => {
  it("passes yes/no/na/null answers through unchanged", () => {
    expect(workspaceAnswerToValue("yes")).toBe("yes");
    expect(workspaceAnswerToValue("no")).toBe("no");
    expect(workspaceAnswerToValue("na")).toBe("na");
    expect(workspaceAnswerToValue(null)).toBeNull();
  });

  it("normalizes legacy string[] checklist answers to { checked, na: [] }", () => {
    expect(workspaceAnswerToValue(["P1", "P2"])).toEqual({
      checked: ["P1", "P2"],
      na: [],
    });
  });

  it("passes checklist answers with per-practice N/A through", () => {
    expect(workspaceAnswerToValue({ checked: ["P1"], na: ["P2"] })).toEqual({
      checked: ["P1"],
      na: ["P2"],
    });
  });

  it("scores a legacy string[] answer identically to the normalized shape (AC-016)", () => {
    const questions = [
      {
        questionId: "Q-CL",
        pillarId: "P-A",
        severity: "high" as const,
        type: "checklist" as const,
        practiceIds: ["P1", "P2", "P3"],
      },
    ];
    const templateRevisions = [
      makeRevision("rev-1", 0, definitionJson(questions)),
    ];
    const pillars = makePillars("rev-1", questions);
    const legacy = deriveWorkspaceMaturity({
      templateRevisions,
      pillars,
      answers: [{ questionId: "Q-CL", answer: ["P1", "P2"], updatedAt: "t" }],
    });
    const modern = deriveWorkspaceMaturity({
      templateRevisions,
      pillars,
      answers: [
        {
          questionId: "Q-CL",
          answer: { checked: ["P1", "P2"], na: [] },
          updatedAt: "t",
        },
      ],
    });

    expect(legacy[0]).toEqual(modern[0]);
    const entry = legacy[0]!;
    if (entry.kind !== "result") throw new Error("expected result");
    expect(entry.trace.result).toEqual({ numerator: "2", denominator: "3" });
  });

  it("treats a missing question riskLevel as medium severity, weight 1 (AC-017)", () => {
    const questions = [yesNo("A-Q1", "P-A", "medium", "yes")];
    const pillars = makePillars("rev-1", questions);
    pillars[0]!.questions[0]!.riskLevel = undefined;
    const entries = deriveWorkspaceMaturity({
      templateRevisions: [makeRevision("rev-1", 0, definitionJson(questions))],
      pillars,
      answers: makeAnswers(questions),
    });

    const entry = entries[0]!;
    if (entry.kind !== "result") throw new Error("expected result");
    expect(entry.trace.questions[0]!.weight).toBe(1);
  });
});

describe("opaque Revision identity (maturity-score/AC-009, AC-025)", () => {
  it("compares templateRevisionId exactly and never parses it", () => {
    const questionsA = revisionQuestions("A");
    const questionsB = revisionQuestions("B");
    const entries = deriveWorkspaceMaturity({
      templateRevisions: [makeRevision("rev-1", 0, definitionJson(questionsA))],
      pillars: [
        ...makePillars("rev-1", questionsA),
        // A prefix-colliding id must not leak its questions into rev-1.
        ...makePillars("rev-1-extra", questionsB),
      ],
      answers: [...makeAnswers(questionsA), ...makeAnswers(questionsB)],
    });

    const entry = entries[0]!;
    if (entry.kind !== "result") throw new Error("expected result");
    expect(entry.coverage.total).toBe(2);
    expect(
      entry.trace.questions.every((q) => q.questionId.startsWith("A-"))
    ).toBe(true);
  });
});

describe("over-limit pinned Revision (reviews/AC-031; maturity-score/AC-042)", () => {
  it("returns a scoped question-limit-exceeded entry with no trace or result", () => {
    const workspace = buildWorkspace(
      makeWorkspaceOptions({
        templateRevisions: [
          makeRevision("rev-big", 0, definitionJson(elevenQuestions)),
        ],
        pillars: makePillars("rev-big", elevenQuestions),
        answers: makeAnswers(elevenQuestions),
      })
    );

    const entry = workspace.maturity[0]!;
    expect(entry).toEqual({
      kind: "configuration-error",
      code: "question-limit-exceeded",
      templateRevisionId: "rev-big",
      questionCount: 11,
      limit: 10,
    });
    expect("trace" in entry).toBe(false);
    expect("effectiveResult" in entry).toBe(false);
  });

  it("keeps sibling Revision results available in the same Review (AC-031)", () => {
    const small = revisionQuestions("A");
    const workspace = buildWorkspace(
      makeWorkspaceOptions({
        templateRevisions: [
          makeRevision("rev-big", 0, definitionJson(elevenQuestions)),
          makeRevision("rev-small", 1, definitionJson(small)),
        ],
        pillars: [
          ...makePillars("rev-big", elevenQuestions),
          ...makePillars("rev-small", small),
        ],
        answers: [...makeAnswers(elevenQuestions), ...makeAnswers(small)],
      })
    );

    expect(workspace.maturity).toHaveLength(2);
    expect(workspace.maturity[0]!.kind).toBe("configuration-error");
    const sibling = workspace.maturity[1]!;
    expect(sibling.kind).toBe("result");
    if (sibling.kind !== "result") return;
    // 2 earned of 3 available (high yes, medium no).
    expect(sibling.trace.result).toEqual({ numerator: "2", denominator: "3" });
    expect(sibling.effectiveResult.displayPercent).toBe(67);
  });
});
