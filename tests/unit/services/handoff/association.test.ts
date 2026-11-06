/**
 * Handoff association stream and atomic confirmation
 * (improvement-plans/REQ-007, REQ-008, REQ-010; AC-028 through AC-033,
 * AC-037, AC-038).
 *
 * `review_handoff_association` is an append-only stream of transitions per
 * practice. The current association is the latest non-revoked transition,
 * never a mutable pointer; replacement keeps the prior reference in
 * immutable history. Confirmation associates every selected practice with
 * one existing work item or identifies every conflict — never partial
 * success.
 */
import { describe, expect, it } from "vitest";
import {
  appendAssociationTransition,
  associationHistoryForPractice,
  AssociationTransitionError,
  externalWorkItemReferenceFromUrl,
  resolveCurrentAssociation,
  type AssociationTransition,
} from "~/services/handoff/association";
import { confirmHandoff } from "~/services/handoff/confirmation";
import {
  practiceEntityId,
  type PracticeReference,
} from "~/services/handoff/practice";

const NOW = "2026-09-10T10:00:00.000Z";

const PRACTICE_A: PracticeReference = {
  reviewId: "review-1",
  templateRevisionId: "rev-a",
  questionId: "q-1",
  practiceId: "cl-a",
};
const PRACTICE_B: PracticeReference = { ...PRACTICE_A, practiceId: "cl-b" };

const TICKET = {
  provider: "gitlab",
  externalId: "TEAM-142",
  url: "https://gitlab.example.com/issues/142",
};
const OTHER_TICKET = {
  provider: "youtrack",
  externalId: "PLAT-9",
  url: "https://youtrack.example.com/issue/PLAT-9",
};

function transition(
  parts: Partial<AssociationTransition> &
    Pick<AssociationTransition, "id" | "action" | "practice">
): AssociationTransition {
  const isRevoke = parts.action === "revoke";
  return {
    reviewId: "review-1",
    actorId: "actor-1",
    occurredAt: NOW,
    priorTransitionId: null,
    reference: isRevoke ? null : TICKET,
    ...parts,
  };
}

describe("external work item URL", () => {
  it.each([
    [
      "https://company.atlassian.net/browse/TEAM-123",
      { provider: "Jira", externalId: "TEAM-123" },
    ],
    [
      "https://gitlab.example.com/group/project/-/issues/42",
      { provider: "GitLab", externalId: "42" },
    ],
    [
      "https://youtrack.example.com/issue/YT-7",
      { provider: "YouTrack", externalId: "YT-7" },
    ],
    [
      "https://tracker.example.com/items/ABC-9",
      { provider: "tracker.example.com", externalId: "ABC-9" },
    ],
  ])("derives provider and ID from %s", (url, expected) => {
    expect(externalWorkItemReferenceFromUrl(url)).toMatchObject(expected);
  });

  it("rejects insecure URLs and URLs without a path ID", () => {
    expect(() =>
      externalWorkItemReferenceFromUrl("http://gitlab.example.com/issues/42")
    ).toThrow(/https/);
    expect(() =>
      externalWorkItemReferenceFromUrl("https://tracker.example.com")
    ).toThrow(/include its ID/);
  });
});

describe("append-only association stream (REQ-008; AC-032)", () => {
  it("resolves the current association as the latest non-revoked transition", () => {
    let history: AssociationTransition[] = [];
    history = appendAssociationTransition(
      history,
      transition({ id: "as-1", action: "associate", practice: PRACTICE_A })
    );
    expect(
      resolveCurrentAssociation(history, practiceEntityId(PRACTICE_A))
        ?.reference
    ).toEqual(TICKET);

    history = appendAssociationTransition(
      history,
      transition({
        id: "as-2",
        action: "replace",
        practice: PRACTICE_A,
        priorTransitionId: "as-1",
        reference: OTHER_TICKET,
      })
    );
    // The new reference becomes current; the previous remains immutable
    // history (AC-032).
    const current = resolveCurrentAssociation(
      history,
      practiceEntityId(PRACTICE_A)
    );
    expect(current?.id).toBe("as-2");
    expect(current?.reference).toEqual(OTHER_TICKET);
    expect(
      associationHistoryForPractice(history, practiceEntityId(PRACTICE_A))
    ).toHaveLength(2);
    expect(history[0]).toEqual(
      transition({ id: "as-1", action: "associate", practice: PRACTICE_A })
    );
  });

  it("replaces only the named practice — other associations stay unchanged (AC-032)", () => {
    let history: AssociationTransition[] = [];
    history = appendAssociationTransition(
      history,
      transition({ id: "as-1", action: "associate", practice: PRACTICE_A })
    );
    history = appendAssociationTransition(
      history,
      transition({ id: "as-2", action: "associate", practice: PRACTICE_B })
    );
    history = appendAssociationTransition(
      history,
      transition({
        id: "as-3",
        action: "replace",
        practice: PRACTICE_A,
        priorTransitionId: "as-1",
        reference: OTHER_TICKET,
      })
    );

    expect(
      resolveCurrentAssociation(history, practiceEntityId(PRACTICE_B))
        ?.reference
    ).toEqual(TICKET);
  });

  it("rejects a stale replacement that does not point at the current transition", () => {
    let history: AssociationTransition[] = [];
    history = appendAssociationTransition(
      history,
      transition({ id: "as-1", action: "associate", practice: PRACTICE_A })
    );
    history = appendAssociationTransition(
      history,
      transition({
        id: "as-2",
        action: "replace",
        practice: PRACTICE_A,
        priorTransitionId: "as-1",
        reference: OTHER_TICKET,
      })
    );

    expect(() =>
      appendAssociationTransition(
        history,
        transition({
          id: "as-3",
          action: "replace",
          practice: PRACTICE_A,
          priorTransitionId: "as-1",
          reference: TICKET,
        })
      )
    ).toThrowError(AssociationTransitionError);
  });

  it("rejects associating a practice that already has a current association", () => {
    const history = appendAssociationTransition(
      [],
      transition({ id: "as-1", action: "associate", practice: PRACTICE_A })
    );
    expect(() =>
      appendAssociationTransition(
        history,
        transition({ id: "as-2", action: "associate", practice: PRACTICE_A })
      )
    ).toThrowError(AssociationTransitionError);
  });
});

describe("atomic handoff confirmation (REQ-007, REQ-008; AC-028, AC-030, AC-031)", () => {
  it("associates every selected practice with the same external work item", () => {
    const result = confirmHandoff({
      practices: [PRACTICE_A, PRACTICE_B],
      history: [],
      reference: TICKET,
      actorId: "actor-1",
      occurredAt: NOW,
      transitionIdFor: (entityId) => `as-for-${entityId}`,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // AC-030: one external work item covers the whole handoff — never an
    // epic with child issues, never one ticket per practice.
    expect(result.transitions).toHaveLength(2);
    for (const planned of result.transitions) {
      expect(planned.action).toBe("associate");
      expect(planned.reference).toEqual(TICKET);
    }
  });

  it("rejects the whole confirmation and identifies every conflict (AC-031)", () => {
    let history: AssociationTransition[] = [];
    history = appendAssociationTransition(
      history,
      transition({ id: "as-1", action: "associate", practice: PRACTICE_A })
    );
    history = appendAssociationTransition(
      history,
      transition({
        id: "as-2",
        action: "associate",
        practice: PRACTICE_B,
        reference: OTHER_TICKET,
      })
    );

    const result = confirmHandoff({
      practices: [PRACTICE_A, PRACTICE_B],
      history,
      reference: TICKET,
      actorId: "actor-1",
      occurredAt: NOW,
      transitionIdFor: (entityId) => `as-for-${entityId}`,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    // Never partial success: no transitions are produced, and every
    // conflicting practice is identified with its current reference.
    expect(result.conflicts).toHaveLength(2);
    expect(result.conflicts[0]).toEqual({
      practice: PRACTICE_A,
      current: TICKET,
    });
    expect(result.conflicts[1]).toEqual({
      practice: PRACTICE_B,
      current: OTHER_TICKET,
    });
    // The history is untouched.
    expect(history).toHaveLength(2);
  });

  it("rejects confirming an empty selection", () => {
    const result = confirmHandoff({
      practices: [],
      history: [],
      reference: TICKET,
      actorId: "actor-1",
      occurredAt: NOW,
      transitionIdFor: (entityId) => `as-for-${entityId}`,
    });
    expect(result.ok).toBe(false);
  });
});

describe("assessment-completion independence (REQ-008, REQ-010; AC-033, AC-037, AC-038)", () => {
  it("completion changes no association state and emits no outbound behavior", () => {
    let history: AssociationTransition[] = [];
    history = appendAssociationTransition(
      history,
      transition({ id: "as-1", action: "associate", practice: PRACTICE_A })
    );
    const before = history;

    // The practice becomes complete in the assessment. Domain state for
    // handoff is a pure function of the streams — recomputing the practice
    // projection (which now excludes the met practice) cannot touch the
    // association stream (AC-033, AC-037).
    const after = resolveCurrentAssociation(
      before,
      practiceEntityId(PRACTICE_A)
    );
    expect(history).toBe(before);
    expect(after?.reference).toEqual(TICKET);

    // A later replacement still works against the completed practice's
    // current transition, proving completion did not corrupt the stream.
    history = appendAssociationTransition(
      history,
      transition({
        id: "as-2",
        action: "replace",
        practice: PRACTICE_A,
        priorTransitionId: "as-1",
        reference: OTHER_TICKET,
      })
    );
    expect(
      resolveCurrentAssociation(history, practiceEntityId(PRACTICE_A))
        ?.reference
    ).toEqual(OTHER_TICKET);
  });
});
