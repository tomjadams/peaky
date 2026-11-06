/**
 * Append-only Advisor override history domain (maturity-score/REQ-016;
 * AC-030, AC-031, AC-043).
 *
 * Overrides are user-authored decisions stored as an append-only stream of
 * transitions keyed by Review and templateRevisionId. A superseding or
 * revoking transition points at the prior one; the effective override is the
 * latest authorized non-revoked transition. Prior transitions and their
 * actors remain immutable history. Authorization is enforced at the server
 * boundary (authorization/REQ-008); the domain models the stream itself.
 */
import { describe, expect, it } from "vitest";
import {
  appendOverrideTransition,
  OverrideTransitionError,
  overrideHistoryForRevision,
  resolveEffectiveOverride,
  type OverrideTransition,
} from "~/services/maturity/override";
import {
  decodeOverrideEvidence,
  OverrideRowDecodeError,
  overrideTransitionFromRow,
  overrideTransitionToRow,
} from "~/services/maturity/overridePersistence";

const REVIEW = "review-1";
const REVISION = "rev-a";

function transition(
  parts: Partial<OverrideTransition> & Pick<OverrideTransition, "id" | "action">
): OverrideTransition {
  const isRevoke = parts.action === "revoke";
  return {
    reviewId: REVIEW,
    templateRevisionId: REVISION,
    actorId: "actor-advisor-1",
    occurredAt: "2026-09-01T10:00:00.000Z",
    priorTransitionId: null,
    reviewedResult: isRevoke ? null : { percent: 80, stage: 4 },
    explanation: "Reviewed on evidence call.",
    evidence: isRevoke ? [] : ["evidence:interview-1"],
    ...parts,
  };
}

describe("override creation (REQ-016; AC-030)", () => {
  it("appends a first create transition and resolves it as the effective value", () => {
    const created = transition({ id: "ovr-1", action: "create" });
    const history = appendOverrideTransition([], created);

    expect(history).toHaveLength(1);
    const effective = resolveEffectiveOverride(history, REVIEW, REVISION);
    expect(effective?.id).toBe("ovr-1");
    // AC-030: actor, explanation, evidence, and time remain available.
    expect(effective?.actorId).toBe("actor-advisor-1");
    expect(effective?.explanation).toBe("Reviewed on evidence call.");
    expect(effective?.evidence).toEqual(["evidence:interview-1"]);
    expect(effective?.occurredAt).toBe("2026-09-01T10:00:00.000Z");
    expect(effective?.reviewedResult).toEqual({ percent: 80, stage: 4 });
  });

  it("resolves no effective override for an empty history", () => {
    expect(resolveEffectiveOverride([], REVIEW, REVISION)).toBeNull();
  });

  it("rejects a create when a current override already exists", () => {
    const history = appendOverrideTransition(
      [],
      transition({ id: "ovr-1", action: "create" })
    );
    expect(() =>
      appendOverrideTransition(
        history,
        transition({ id: "ovr-2", action: "create" })
      )
    ).toThrowError(OverrideTransitionError);
  });

  it("rejects a create carrying a non-null prior transition", () => {
    expect(() =>
      appendOverrideTransition(
        [],
        transition({ id: "ovr-1", action: "create", priorTransitionId: "x" })
      )
    ).toThrowError(OverrideTransitionError);
  });
});

describe("supersession by any current Advisor (AC-031, AC-043)", () => {
  it("lets a different Advisor supersede; the new transition becomes current", () => {
    const created = transition({ id: "ovr-1", action: "create" });
    const superseded = transition({
      id: "ovr-2",
      action: "supersede",
      actorId: "actor-advisor-2",
      occurredAt: "2026-09-02T10:00:00.000Z",
      priorTransitionId: "ovr-1",
      reviewedResult: { percent: 60, stage: 3 },
      explanation: "Re-scored after re-review.",
    });
    const history = appendOverrideTransition(
      appendOverrideTransition([], created),
      superseded
    );

    const effective = resolveEffectiveOverride(history, REVIEW, REVISION);
    expect(effective?.id).toBe("ovr-2");
    expect(effective?.actorId).toBe("actor-advisor-2");
    expect(effective?.reviewedResult).toEqual({ percent: 60, stage: 3 });

    // AC-031: the prior override is preserved as immutable history.
    expect(history).toHaveLength(2);
    expect(history[0]).toEqual(created);
    // AC-043: prior transitions and their actors remain immutable history.
    expect(history[0]!.actorId).toBe("actor-advisor-1");
  });

  it("is append-only: appending never mutates the existing history array", () => {
    const first = appendOverrideTransition(
      [],
      transition({ id: "ovr-1", action: "create" })
    );
    const before = [...first];
    appendOverrideTransition(
      first,
      transition({
        id: "ovr-2",
        action: "revoke",
        priorTransitionId: "ovr-1",
        evidence: [],
      })
    );
    expect(first).toEqual(before);
  });

  it("rejects a supersede pointing at a stale prior transition", () => {
    const history = appendOverrideTransition(
      [],
      transition({ id: "ovr-1", action: "create" })
    );
    expect(() =>
      appendOverrideTransition(
        history,
        transition({
          id: "ovr-2",
          action: "supersede",
          priorTransitionId: "nope",
        })
      )
    ).toThrowError(OverrideTransitionError);
  });

  it("rejects a supersede with no current override", () => {
    expect(() =>
      appendOverrideTransition(
        [],
        transition({ id: "ovr-1", action: "supersede" })
      )
    ).toThrowError(OverrideTransitionError);
  });
});

describe("revocation (AC-031)", () => {
  function revokedHistory() {
    const created = transition({ id: "ovr-1", action: "create" });
    const revoked = transition({
      id: "ovr-2",
      action: "revoke",
      actorId: "actor-advisor-2",
      occurredAt: "2026-09-02T10:00:00.000Z",
      priorTransitionId: "ovr-1",
      reviewedResult: null,
      explanation: "Evidence no longer stands.",
      evidence: [],
    });
    return appendOverrideTransition(
      appendOverrideTransition([], created),
      revoked
    );
  }

  it("resolves no effective override while preserving the full history", () => {
    const history = revokedHistory();
    expect(resolveEffectiveOverride(history, REVIEW, REVISION)).toBeNull();
    expect(history).toHaveLength(2);
    expect(history[0]!.action).toBe("create");
    expect(history[1]!.action).toBe("revoke");
  });

  it("allows a fresh create after revocation, pointed at null", () => {
    const history = revokedHistory();
    const recreated = transition({
      id: "ovr-3",
      action: "create",
      occurredAt: "2026-09-03T10:00:00.000Z",
    });
    const next = appendOverrideTransition(history, recreated);
    expect(resolveEffectiveOverride(next, REVIEW, REVISION)?.id).toBe("ovr-3");
  });

  it("rejects a revoke carrying a reviewed result", () => {
    const history = appendOverrideTransition(
      [],
      transition({ id: "ovr-1", action: "create" })
    );
    expect(() =>
      appendOverrideTransition(
        history,
        transition({
          id: "ovr-2",
          action: "revoke",
          priorTransitionId: "ovr-1",
          reviewedResult: { percent: 10, stage: 1 },
        })
      )
    ).toThrowError(OverrideTransitionError);
  });
});

describe("deterministic resolution for every consumer (AC-031)", () => {
  it("resolves the same effective value regardless of stream arrival order", () => {
    const created = transition({ id: "ovr-1", action: "create" });
    const superseded = transition({
      id: "ovr-2",
      action: "supersede",
      occurredAt: "2026-09-02T10:00:00.000Z",
      priorTransitionId: "ovr-1",
    });
    const inOrder = [created, superseded];
    const outOfOrder = [superseded, created];

    expect(resolveEffectiveOverride(inOrder, REVIEW, REVISION)?.id).toBe(
      "ovr-2"
    );
    expect(resolveEffectiveOverride(outOfOrder, REVIEW, REVISION)?.id).toBe(
      "ovr-2"
    );
    // Concurrent appends at one timestamp resolve deterministically by id.
    const concurrent = [
      transition({
        id: "ovr-b",
        action: "create",
        reviewedResult: { percent: 50, stage: 3 },
      }),
      transition({
        id: "ovr-a",
        action: "create",
        reviewedResult: { percent: 70, stage: 4 },
      }),
    ];
    expect(resolveEffectiveOverride(concurrent, REVIEW, REVISION)?.id).toBe(
      "ovr-b"
    );
    expect(
      resolveEffectiveOverride(concurrent.toReversed(), REVIEW, REVISION)?.id
    ).toBe("ovr-b");
  });

  it("scopes history by exact Review and templateRevisionId, never parsing ids", () => {
    const own = transition({ id: "ovr-1", action: "create" });
    const otherRevision = transition({
      id: "ovr-2",
      action: "create",
      templateRevisionId: "rev-b",
    });
    // A prefix-colliding id must not leak into the exact-match scope.
    const colliding = transition({
      id: "ovr-3",
      action: "create",
      templateRevisionId: "rev-a-extra",
    });
    const history = [own, otherRevision, colliding];

    expect(
      overrideHistoryForRevision(history, REVIEW, REVISION).map((t) => t.id)
    ).toEqual(["ovr-1"]);
    expect(resolveEffectiveOverride(history, REVIEW, REVISION)?.id).toBe(
      "ovr-1"
    );
    expect(resolveEffectiveOverride(history, "review-2", REVISION)).toBeNull();
  });
});

describe("transition validation (REQ-016)", () => {
  it("rejects an unknown action", () => {
    expect(() =>
      appendOverrideTransition(
        [],
        transition({ id: "ovr-1", action: "delete" as never })
      )
    ).toThrowError(OverrideTransitionError);
  });

  it.each([
    ["non-integer percent", { percent: 80.5, stage: 4 }],
    ["out-of-range percent", { percent: 101, stage: 4 }],
    ["negative percent", { percent: -1, stage: 4 }],
    ["out-of-range stage", { percent: 80, stage: 6 }],
    ["zero stage", { percent: 80, stage: 0 }],
  ] as const)("rejects a reviewed result with %s", (_label, reviewedResult) => {
    expect(() =>
      appendOverrideTransition(
        [],
        transition({ id: "ovr-1", action: "create", reviewedResult })
      )
    ).toThrowError(OverrideTransitionError);
  });

  it("rejects a create without a reviewed result", () => {
    expect(() =>
      appendOverrideTransition(
        [],
        transition({ id: "ovr-1", action: "create", reviewedResult: null })
      )
    ).toThrowError(OverrideTransitionError);
  });

  it.each(["create" as const, "supersede" as const, "revoke" as const])(
    "rejects a %s with a blank explanation",
    (action) => {
      const base = transition({ id: "ovr-1", action: "create" });
      const history =
        action === "create" ? [] : appendOverrideTransition([], base);
      expect(() =>
        appendOverrideTransition(
          history,
          transition({
            id: "ovr-9",
            action,
            priorTransitionId: action === "create" ? null : "ovr-1",
            reviewedResult:
              action === "revoke" ? null : { percent: 50, stage: 3 },
            evidence: action === "revoke" ? [] : ["evidence:x"],
            explanation: "   ",
          })
        )
      ).toThrowError(OverrideTransitionError);
    }
  );

  it("rejects a create without evidence", () => {
    expect(() =>
      appendOverrideTransition(
        [],
        transition({ id: "ovr-1", action: "create", evidence: [] })
      )
    ).toThrowError(OverrideTransitionError);
  });
});

describe("override row codec (REQ-016)", () => {
  it("round-trips every action through the row codec", () => {
    for (const action of ["create", "supersede", "revoke"] as const) {
      const value = transition({
        id: `ovr-${action}`,
        action,
        priorTransitionId: action === "create" ? null : "ovr-prior",
        reviewedResult: action === "revoke" ? null : { percent: 80, stage: 4 },
        evidence: action === "revoke" ? [] : ["evidence:interview-1"],
      });
      expect(overrideTransitionFromRow(overrideTransitionToRow(value))).toEqual(
        value
      );
    }
  });

  it("decodes null or empty evidence to no identifiers", () => {
    expect(decodeOverrideEvidence(null)).toEqual([]);
    expect(decodeOverrideEvidence("")).toEqual([]);
    expect(decodeOverrideEvidence('["a","b"]')).toEqual(["a", "b"]);
  });

  it.each([
    ["malformed JSON", "not-json"],
    ["a non-array payload", '{"a":1}'],
    ["a non-string entry", "[1]"],
  ] as const)("rejects evidence with %s", (_label, evidence) => {
    expect(() => decodeOverrideEvidence(evidence)).toThrowError(
      OverrideRowDecodeError
    );
  });

  it("rejects a row whose action violates the stored value invariant", () => {
    const row = overrideTransitionToRow(
      transition({ id: "ovr-1", action: "create" })
    );
    expect(() =>
      overrideTransitionFromRow({ ...row, reviewedPercent: null })
    ).toThrowError(OverrideRowDecodeError);
    expect(() =>
      overrideTransitionFromRow({ ...row, action: "delete" })
    ).toThrowError(OverrideRowDecodeError);
    expect(() =>
      overrideTransitionFromRow({ ...row, reviewedStage: 9 })
    ).toThrowError(OverrideRowDecodeError);
  });
});
