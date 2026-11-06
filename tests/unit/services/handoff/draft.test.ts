/**
 * Synchronized handoff draft domain (improvement-plans/REQ-005, REQ-006;
 * AC-015, AC-020, AC-021, AC-023, AC-025, AC-026, AC-027).
 *
 * The draft is NOT an entity: it is derived from the set of selected
 * `review_handoff_practice` rows (design Decision 3). Its label is derived
 * from the review and the selected-practice count, is never user-editable,
 * and is never a provider payload. Selection, removal, rationale editing,
 * and reordering are ordinary field-level edits on practice rows.
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  deriveHandoffDraft,
  handoffDraftLabel,
  removePractice,
  reorderPractice,
  selectPractice,
  setRationale,
  type HandoffPracticeRecord,
} from "~/services/handoff/draft";
import type { SelectablePractice } from "~/services/handoff/projection";
import { resetFixtureIds } from "../review/improvementPlanFixtures";

beforeEach(() => resetFixtureIds());

const NOW = "2026-09-10T10:00:00.000Z";

function makePractice(
  overrides: Partial<{
    reviewId: string;
    templateRevisionId: string;
    questionId: string;
    practiceId: string;
    title: string;
  }> = {}
): SelectablePractice {
  const questionId = overrides.questionId ?? "q-1";
  const practiceId = overrides.practiceId ?? questionId;
  const reference = {
    reviewId: overrides.reviewId ?? "review-1",
    templateRevisionId: overrides.templateRevisionId ?? "rev-a",
    questionId,
    practiceId,
  };
  return {
    reference,
    entityId: `review_handoff_practice:${reference.reviewId}/${reference.templateRevisionId}/${questionId}/${practiceId}`,
    title: overrides.title ?? `Practice ${practiceId}`,
    questionText: `Question ${questionId}`,
    pillarSlug: "security",
    pillarName: "Security",
    templateName: "Security Review",
    revisionNumber: 2,
    severity: "high",
    evidence: {
      state: "unmet",
      provenance: { kind: "yes-no", answer: "no" },
    },
    leadingPractices: ["Automate the control"],
    helpfulLinks: [{ title: "Guide", url: "https://example.com/guide" }],
    deepLink: {
      name: "team-review-assessment",
      params: { teamId: "team-1", reviewId: reference.reviewId },
      query: { templateRevisionId: reference.templateRevisionId },
      hash: `#question-${questionId}`,
    },
    currentAssociation: null,
  };
}

function selectAll(practices: SelectablePractice[]): HandoffPracticeRecord[] {
  let rows: HandoffPracticeRecord[] = [];
  for (const practice of practices) {
    rows = selectPractice({
      existing: rows,
      practice,
      actorId: "actor-1",
      occurredAt: NOW,
    });
  }
  return rows;
}

describe("ordered draft snapshots (REQ-006; AC-021)", () => {
  it("persists the selected order and the full practice context", () => {
    const rows = selectAll([
      makePractice({ questionId: "q-1", practiceId: "cl-a", title: "A" }),
      makePractice({ questionId: "q-1", practiceId: "cl-b", title: "B" }),
    ]);

    const draft = deriveHandoffDraft(rows, {
      reviewId: "review-1",
      reviewName: "Q3 Readiness",
    });
    expect(draft.kind).toBe("ready");
    if (draft.kind !== "ready") return;

    expect(draft.practices.map((p) => p.record.snapshot.title)).toEqual([
      "A",
      "B",
    ]);
    const [first] = draft.practices;
    // AC-021: order, practice text, rationale, leading practices, helpful
    // links, review ID, templateRevisionId, question ID, practice ID,
    // evidence IDs, and source identifiers are all preserved.
    expect(first!.position).toBe(1);
    expect(first!.record.snapshot.title).toBe("A");
    expect(first!.record.rationale).toBeNull();
    expect(first!.record.snapshot.leadingPractices).toEqual([
      "Automate the control",
    ]);
    expect(first!.record.snapshot.helpfulLinks).toEqual([
      { title: "Guide", url: "https://example.com/guide" },
    ]);
    expect(first!.record.reference).toEqual({
      reviewId: "review-1",
      templateRevisionId: "rev-a",
      questionId: "q-1",
      practiceId: "cl-a",
    });
    expect(first!.record.snapshot.evidenceIdentifiers).toEqual([]);
    expect(first!.record.snapshot.templateName).toBe("Security Review");
    expect(first!.record.snapshot.revisionNumber).toBe(2);
  });

  it("reorders practices and reports the new position out of the total", () => {
    const rows = selectAll([
      makePractice({ practiceId: "cl-a", title: "A" }),
      makePractice({ practiceId: "cl-b", title: "B" }),
      makePractice({ practiceId: "cl-c", title: "C" }),
    ]);
    const moved = reorderPractice(rows, rows[2]!.id, 0);
    const draft = deriveHandoffDraft(moved, {
      reviewId: "review-1",
      reviewName: "Q3 Readiness",
    });
    if (draft.kind !== "ready") throw new Error("expected ready draft");
    expect(draft.practices.map((p) => p.record.snapshot.title)).toEqual([
      "C",
      "A",
      "B",
    ]);
    expect(draft.practices[0]!.position).toBe(1);
    expect(draft.practices[0]!.total).toBe(3);
  });

  it("captures the practice wording as a snapshot at selection time", () => {
    const rows = selectAll([makePractice({ title: "Original wording" })]);
    // A later projection with reworded template text cannot rewrite the
    // snapshot already handed off (design risk: snapshots stay distinct).
    expect(rows[0]!.snapshot.title).toBe("Original wording");
  });
});

describe("derived draft label (REQ-006; AC-025, AC-026)", () => {
  it("derives the label from the review and the selected-practice count", () => {
    expect(handoffDraftLabel("Q3 Readiness", 1)).toContain("Q3 Readiness");
    expect(handoffDraftLabel("Q3 Readiness", 1)).toContain("1");
    expect(handoffDraftLabel("Q3 Readiness", 7)).toContain("7");
    expect(handoffDraftLabel("Q3 Readiness", 7)).not.toBe(
      handoffDraftLabel("Q3 Readiness", 8)
    );
  });

  it("exposes no editable draft title anywhere in the derived draft", () => {
    const rows = selectAll([makePractice({})]);
    const draft = deriveHandoffDraft(rows, {
      reviewId: "review-1",
      reviewName: "Q3 Readiness",
    });
    // AC-025/AC-026: the draft is identified by review + selected practices;
    // no title field exists to edit or to leak into a provider payload.
    expect("title" in draft).toBe(false);
    if (draft.kind !== "ready") throw new Error("expected ready draft");
    expect(draft.label).toBe(handoffDraftLabel("Q3 Readiness", 1));
    for (const practice of draft.practices) {
      expect("title" in practice.record).toBe(false);
    }
  });
});

describe("empty selection state (REQ-006; AC-027)", () => {
  it("renders an explicit empty state naming the adding action", () => {
    const draft = deriveHandoffDraft([], {
      reviewId: "review-1",
      reviewName: "Q3 Readiness",
    });
    expect(draft.kind).toBe("empty");
    if (draft.kind !== "empty") return;
    // The empty state names the action that adds practices; it is not an
    // empty draft list.
    expect(draft.action).toMatch(/select practices/i);
    expect("practices" in draft).toBe(false);
  });

  it("a draft with every practice removed returns to the empty state", () => {
    let rows = selectAll([makePractice({ practiceId: "cl-a" })]);
    rows = removePractice(rows, rows[0]!.id);
    expect(
      deriveHandoffDraft(rows, { reviewId: "review-1", reviewName: "R" }).kind
    ).toBe("empty");
  });
});

describe("selection independence and reversibility (REQ-005, REQ-006; AC-015, AC-020, AC-023)", () => {
  it("selecting one checklist practice leaves siblings unselected (AC-015)", () => {
    const rows = selectAll([makePractice({ practiceId: "cl-a" })]);
    const draft = deriveHandoffDraft(rows, {
      reviewId: "review-1",
      reviewName: "R",
    });
    if (draft.kind !== "ready") throw new Error("expected ready draft");
    expect(draft.practices).toHaveLength(1);
    expect(draft.practices[0]!.record.reference.practiceId).toBe("cl-a");
  });

  it("preserves exact Revision identity for cross-Revision selections (AC-020)", () => {
    const rows = selectAll([
      makePractice({ templateRevisionId: "rev-01", practiceId: "p-1" }),
      makePractice({ templateRevisionId: "rev-1", practiceId: "p-2" }),
    ]);
    const draft = deriveHandoffDraft(rows, {
      reviewId: "review-1",
      reviewName: "R",
    });
    if (draft.kind !== "ready") throw new Error("expected ready draft");
    expect(
      draft.practices.map((p) => p.record.reference.templateRevisionId)
    ).toEqual(["rev-01", "rev-1"]);
  });

  it("removal marks the row removed without deleting its context (AC-023)", () => {
    let rows = selectAll([
      makePractice({ practiceId: "cl-a", title: "A" }),
      makePractice({ practiceId: "cl-b", title: "B" }),
    ]);
    rows = setRationale(rows, rows[1]!.id, "Coordinate with platform");
    const removed = removePractice(rows, rows[1]!.id);

    // The row survives with its snapshot and rationale; only its selection
    // state changes, so cancelling a preview never destroys draft context.
    expect(removed).toHaveLength(2);
    expect(removed[1]!.selectionState).toBe("removed");
    expect(removed[1]!.rationale).toBe("Coordinate with platform");

    // Re-selecting restores the row without losing its context.
    const reselected = selectPractice({
      existing: removed,
      practice: makePractice({ practiceId: "cl-b", title: "B" }),
      actorId: "actor-1",
      occurredAt: NOW,
    });
    expect(reselected[1]!.selectionState).toBe("selected");
    expect(reselected[1]!.rationale).toBe("Coordinate with platform");
  });

  it("deriving the draft never mutates the practice rows", () => {
    const rows = selectAll([makePractice({})]);
    const before = structuredClone(rows);
    deriveHandoffDraft(rows, { reviewId: "review-1", reviewName: "R" });
    expect(rows).toEqual(before);
  });
});
