/**
 * Handoff practice projection (improvement-plans/REQ-005; AC-015 through
 * AC-020).
 *
 * The Improvement Plan exposes each unmet checklist practice as one
 * independently selectable practice and a negative Yes/No question as one
 * standalone practice reusing its question ID. Practice identity is the
 * tuple (reviewId, templateRevisionId, questionId, practiceId) with
 * templateRevisionId compared exactly and never parsed. Evidence state is
 * binary (met | unmet); N/A is excluded and no third state exists.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { assessmentDeepLink } from "~/services/review/ImprovementPlanProjection";
import {
  practiceEntityId,
  type PracticeReference,
} from "~/services/handoff/practice";
import { projectSelectablePractices } from "~/services/handoff/projection";
import type { ExternalWorkItemReference } from "~/services/handoff/association";
import {
  makeChecklistAnswer,
  makeChecklistTemplateQuestion,
  makeNAAnswer,
  makeNoAnswer,
  makeTeamReviewContext,
  makeUnanswered,
  makeTemplatePillar,
  makeTemplateQuestion,
  makeTemplateRevisionDetail,
  makeYesAnswer,
  resetFixtureIds,
} from "../review/improvementPlanFixtures";

beforeEach(() => resetFixtureIds());

const REFERENCE: PracticeReference = {
  reviewId: "review-1",
  templateRevisionId: "rev-a",
  questionId: "q-1",
  practiceId: "cl-1",
};

describe("practice identity (REQ-005; AC-016, AC-017)", () => {
  it("derives a deterministic entity ID from the practice tuple", () => {
    // Concurrent clients converge on one synchronized row (design Decision 3).
    expect(practiceEntityId(REFERENCE)).toBe(
      practiceEntityId({ ...REFERENCE })
    );
  });

  it("distinguishes tuples that differ in any component", () => {
    const base = practiceEntityId(REFERENCE);
    expect(practiceEntityId({ ...REFERENCE, practiceId: "cl-2" })).not.toBe(
      base
    );
    expect(
      practiceEntityId({ ...REFERENCE, templateRevisionId: "rev-b" })
    ).not.toBe(base);
    expect(practiceEntityId({ ...REFERENCE, questionId: "q-2" })).not.toBe(
      base
    );
    expect(practiceEntityId({ ...REFERENCE, reviewId: "review-2" })).not.toBe(
      base
    );
  });

  it("compares templateRevisionId exactly — near-collisions stay distinct (AC-017)", () => {
    // IDs that would collide under any parsing or normalization ("rev-01"
    // vs "rev-1", separator-containing IDs) must remain distinct rows.
    const a = practiceEntityId({ ...REFERENCE, templateRevisionId: "rev-01" });
    const b = practiceEntityId({ ...REFERENCE, templateRevisionId: "rev-1" });
    const c = practiceEntityId({
      ...REFERENCE,
      templateRevisionId: "rev::1::draft",
    });
    expect(new Set([a, b, c]).size).toBe(3);
  });
});

describe("checklist practice independence (REQ-005; AC-015)", () => {
  it("projects each unmet checklist practice as its own selectable row", () => {
    const question = makeChecklistTemplateQuestion(
      [
        { id: "cl-a", text: "Practice A" },
        { id: "cl-b", text: "Practice B" },
        { id: "cl-c", text: "Practice C" },
      ],
      { id: "q-cl" }
    );
    const template = makeTemplateRevisionDetail({
      id: "rev-a",
      pillars: [makeTemplatePillar({ questions: [question] })],
    });
    const ctx = makeTeamReviewContext({
      reviewId: "review-1",
      templates: [template],
      // cl-b is met (checked); cl-a and cl-c are unmet.
      answers: [makeChecklistAnswer("q-cl", ["cl-b"])],
    });

    const practices = projectSelectablePractices(ctx);
    expect(practices.map((p) => p.reference.practiceId)).toEqual([
      "cl-a",
      "cl-c",
    ]);
    // Each unmet practice has an independent identity — selecting one can
    // never select or block a sibling (AC-015).
    const entityIds = practices.map((p) => p.entityId);
    expect(new Set(entityIds).size).toBe(2);
    expect(practices[0]!.title).toBe("Practice A");
    expect(practices[1]!.title).toBe("Practice C");
  });
});

describe("checklist answer semantics", () => {
  const question = makeChecklistTemplateQuestion(
    [
      { id: "cl-a", text: "Practice A" },
      { id: "cl-b", text: "Practice B" },
    ],
    { id: "q-cl" }
  );
  const template = makeTemplateRevisionDetail({
    id: "rev-a",
    pillars: [makeTemplatePillar({ questions: [question] })],
  });

  it("does not convert a missing or null checklist answer into unmet practices", () => {
    const missing = makeTeamReviewContext({
      templates: [template],
      answers: [],
    });
    const unanswered = makeTeamReviewContext({
      templates: [template],
      answers: [makeUnanswered("q-cl")],
    });

    expect(projectSelectablePractices(missing)).toEqual([]);
    expect(projectSelectablePractices(unanswered)).toEqual([]);
  });

  it("projects every unchecked item from an explicitly recorded empty checklist", () => {
    const currentShape = makeTeamReviewContext({
      templates: [template],
      answers: [makeChecklistAnswer("q-cl", [])],
    });
    const legacyShape = makeTeamReviewContext({
      templates: [template],
      answers: [{ questionId: "q-cl", answer: "[]" }],
    });

    for (const context of [currentShape, legacyShape]) {
      expect(
        projectSelectablePractices(context).map(
          (practice) => practice.reference.practiceId
        )
      ).toEqual(["cl-a", "cl-b"]);
    }
  });

  it("ignores answers left behind by either direction of question retyping", () => {
    const yesNo = makeTemplateQuestion({ id: "q-yn", type: "yes-no" });
    const mixedTemplate = makeTemplateRevisionDetail({
      id: "rev-a",
      pillars: [makeTemplatePillar({ questions: [question, yesNo] })],
    });
    const ctx = makeTeamReviewContext({
      templates: [mixedTemplate],
      answers: [makeNoAnswer("q-cl"), makeChecklistAnswer("q-yn", [])],
    });

    expect(projectSelectablePractices(ctx)).toEqual([]);
  });
});

describe("yes/no practice identity (REQ-005; AC-016)", () => {
  it("projects a negative yes/no question as one practice reusing its question ID", () => {
    const question = makeTemplateQuestion({ id: "q-yn", type: "yes-no" });
    const template = makeTemplateRevisionDetail({
      id: "rev-a",
      pillars: [makeTemplatePillar({ questions: [question] })],
    });
    const ctx = makeTeamReviewContext({
      reviewId: "review-1",
      templates: [template],
      answers: [makeNoAnswer("q-yn")],
    });

    const practices = projectSelectablePractices(ctx);
    expect(practices).toHaveLength(1);
    expect(practices[0]!.reference.questionId).toBe("q-yn");
    expect(practices[0]!.reference.practiceId).toBe("q-yn");
  });
});

describe("binary evidence state (REQ-005; AC-019)", () => {
  it("excludes met, N/A, and unanswered answers — evidence state is exactly met or unmet", () => {
    const checklist = makeChecklistTemplateQuestion(
      [
        { id: "cl-met", text: "Done" },
        { id: "cl-na", text: "Not applicable" },
        { id: "cl-gap", text: "Missing" },
      ],
      { id: "q-cl" }
    );
    const yesNo = makeTemplateQuestion({ id: "q-yes", type: "yes-no" });
    const naQuestion = makeTemplateQuestion({ id: "q-na", type: "yes-no" });
    const template = makeTemplateRevisionDetail({
      id: "rev-a",
      pillars: [
        makeTemplatePillar({ questions: [checklist, yesNo, naQuestion] }),
      ],
    });
    const ctx = makeTeamReviewContext({
      reviewId: "review-1",
      templates: [template],
      answers: [
        makeChecklistAnswer("q-cl", ["cl-met"], ["cl-na"]),
        makeYesAnswer("q-yes"),
        makeNAAnswer("q-na"),
      ],
    });

    const practices = projectSelectablePractices(ctx);
    // Only the unmet, non-N/A checklist practice survives.
    expect(practices.map((p) => p.reference.practiceId)).toEqual(["cl-gap"]);
    // No third evidence state such as "needs validation" can appear.
    for (const practice of practices) {
      expect(["met", "unmet"]).toContain(practice.evidence.state);
    }
    expect(practices[0]!.evidence.state).toBe("unmet");
  });

  it("records evidence provenance from the recorded answer (AC-018)", () => {
    const question = makeTemplateQuestion({ id: "q-yn", type: "yes-no" });
    const template = makeTemplateRevisionDetail({
      id: "rev-a",
      pillars: [makeTemplatePillar({ questions: [question] })],
    });
    const ctx = makeTeamReviewContext({
      reviewId: "review-1",
      templates: [template],
      answers: [makeNoAnswer("q-yn")],
    });

    const [practice] = projectSelectablePractices(ctx);
    expect(practice!.evidence.provenance).toEqual({
      kind: "yes-no",
      answer: "no",
    });
  });
});

describe("practice row context (REQ-005; AC-018)", () => {
  it("carries pinned Revision identity, question context, and an assessment deep link", () => {
    const question = makeTemplateQuestion({ id: "q-yn", type: "yes-no" });
    const template = makeTemplateRevisionDetail({
      id: "rev-a",
      name: "Security Review",
      revisionNumber: 3,
      pillars: [
        makeTemplatePillar({
          slug: "security",
          name: "Security",
          questions: [question],
        }),
      ],
    });
    const ctx = makeTeamReviewContext({
      reviewId: "review-1",
      subjectId: "team-1",
      templates: [template],
      answers: [makeNoAnswer("q-yn")],
    });

    const [practice] = projectSelectablePractices(ctx);
    expect(practice!.reference.templateRevisionId).toBe("rev-a");
    expect(practice!.revisionNumber).toBe(3);
    expect(practice!.pillarName).toBe("Security");
    // Deep link reuses the existing assessment route helpers.
    expect(practice!.deepLink).toEqual(
      assessmentDeepLink({
        reviewId: "review-1",
        subjectId: "team-1",
        subjectType: "team",
        templateId: template.templateId,
        templateRevisionId: "rev-a",
        pillarSlug: "security",
        questionId: "q-yn",
      })
    );
    expect(practice!.deepLink.hash).toBe("#question-q-yn");
  });

  it("surfaces the current external reference for the practice", () => {
    const question = makeTemplateQuestion({ id: "q-yn", type: "yes-no" });
    const template = makeTemplateRevisionDetail({
      id: "rev-a",
      pillars: [makeTemplatePillar({ questions: [question] })],
    });
    const ctx = makeTeamReviewContext({
      reviewId: "review-1",
      templates: [template],
      answers: [makeNoAnswer("q-yn")],
    });
    const reference: ExternalWorkItemReference = {
      provider: "gitlab",
      externalId: "TEAM-142",
      url: "https://gitlab.example.com/issues/142",
    };
    const [unassociated] = projectSelectablePractices(ctx);
    expect(unassociated!.currentAssociation).toBeNull();

    const entityId = practiceEntityId({
      reviewId: "review-1",
      templateRevisionId: "rev-a",
      questionId: "q-yn",
      practiceId: "q-yn",
    });
    const [associated] = projectSelectablePractices(
      ctx,
      new Map([[entityId, reference]])
    );
    expect(associated!.currentAssociation).toEqual(reference);
  });
});

describe("cross-Revision selection (REQ-005; AC-020)", () => {
  it("projects practices for every selected Revision, preserving exact Revision identity", () => {
    const templateA = makeTemplateRevisionDetail({
      id: "rev-01",
      pillars: [
        makeTemplatePillar({
          questions: [makeTemplateQuestion({ id: "q-a", type: "yes-no" })],
        }),
      ],
    });
    const templateB = makeTemplateRevisionDetail({
      id: "rev-1",
      pillars: [
        makeTemplatePillar({
          questions: [makeTemplateQuestion({ id: "q-b", type: "yes-no" })],
        }),
      ],
    });
    const ctx = makeTeamReviewContext({
      reviewId: "review-1",
      templates: [templateA, templateB],
      answers: [makeNoAnswer("q-a"), makeNoAnswer("q-b")],
    });

    const practices = projectSelectablePractices(ctx);
    expect(practices).toHaveLength(2);
    // Exact, unparsed Revision identity is preserved per practice — no
    // cross-Revision rollup collapses "rev-01" and "rev-1".
    expect(practices.map((p) => p.reference.templateRevisionId)).toEqual([
      "rev-01",
      "rev-1",
    ]);
  });
});
