/**
 * Versioned HandoffLimits contract (improvement-plans/REQ-011; AC-039
 * through AC-043; local-first/REQ-013, AC-021 through AC-023).
 *
 * The single shared fixture `tests/fixtures/handoff-limits.v1.json` holds
 * every boundary vector; this is the one table-driven TypeScript consumer,
 * and group 6.6 adds the Go consumer of the same file. Vectors are never
 * repeated per layer. Limits count Unicode code points, never encoded
 * bytes, and rejection is atomic with field-addressable errors — no value
 * is truncated and no collection entry is dropped.
 */
import { describe, expect, it } from "vitest";
import {
  characterCount,
  HANDOFF_LIMITS,
  HANDOFF_LIMITS_VERSION,
  HandoffLimitError,
  validateEvidenceIdentifiers,
  validateHelpfulLinks,
  validateHttpsUrl,
  validateIdentifier,
  validatePracticeCount,
  validatePracticeSnapshot,
  validateRationale,
  type HandoffLimitViolation,
} from "~/services/handoff/limits";
import {
  selectPractice,
  setRationale,
  type HandoffPracticeRecord,
} from "~/services/handoff/draft";
import { confirmHandoff } from "~/services/handoff/confirmation";
import {
  handoffPracticeToRow,
  associationTransitionToRow,
} from "~/services/handoff/persistence";
import type { SelectablePractice } from "~/services/handoff/projection";
import fixture from "../../../fixtures/handoff-limits.v1.json";

const NOW = "2026-09-10T10:00:00.000Z";

// ─── Fixture ↔ contract parity (AC-043) ─────────────────────

describe("HandoffLimits fixture parity (REQ-011; AC-043)", () => {
  it("the fixture version matches the domain contract version", () => {
    expect(fixture.version).toBe(HANDOFF_LIMITS_VERSION);
  });

  it("the fixture limits match the central contract exactly", () => {
    expect(fixture.limits).toEqual({
      rationaleChars: HANDOFF_LIMITS.rationaleChars,
      identifierChars: HANDOFF_LIMITS.identifierChars,
      urlChars: HANDOFF_LIMITS.urlChars,
      helpfulLinksPerPractice: HANDOFF_LIMITS.helpfulLinksPerPractice,
      evidenceIdentifiersPerPractice:
        HANDOFF_LIMITS.evidenceIdentifiersPerPractice,
      practicesPerHandoff: HANDOFF_LIMITS.practicesPerHandoff,
    });
  });
});

// ─── Table-driven boundary vectors (AC-039 through AC-042) ──

type TextVector = {
  id: string;
  kind: "text";
  field: string;
  char: string;
  length: number;
  expect: "accept" | "reject";
};
type UrlVector = {
  id: string;
  kind: "url";
  field: string;
  length: number;
  expect: "accept" | "reject";
};
type ExplicitUrlVector = {
  id: string;
  kind: "url-explicit";
  field: string;
  value: string;
  expect: "accept" | "reject";
};
type CollectionVector = {
  id: string;
  kind: "collection";
  field: string;
  count: number;
  expect: "accept" | "reject";
};
type PracticeCountVector = {
  id: string;
  kind: "practice-count";
  field: string;
  count: number;
  expect: "accept" | "reject";
};
type Vector =
  | TextVector
  | UrlVector
  | ExplicitUrlVector
  | CollectionVector
  | PracticeCountVector;

const URL_PREFIX = "https://example.com/";

function runVector(vector: Vector): HandoffLimitViolation[] {
  switch (vector.kind) {
    case "text": {
      const value = vector.char.repeat(vector.length);
      if (vector.field === "rationale") return validateRationale(value);
      return validateIdentifier(value, vector.field);
    }
    case "url": {
      const padding = vector.length - URL_PREFIX.length;
      return validateHttpsUrl(
        `${URL_PREFIX}${"p".repeat(padding)}`,
        vector.field
      );
    }
    case "url-explicit":
      return validateHttpsUrl(vector.value, vector.field);
    case "collection": {
      if (vector.field === "helpfulLinks") {
        return validateHelpfulLinks(
          Array.from({ length: vector.count }, (_, index) => ({
            title: `Link ${index}`,
            url: `${URL_PREFIX}${index}`,
          }))
        );
      }
      return validateEvidenceIdentifiers(
        Array.from({ length: vector.count }, (_, index) => `ev-${index}`)
      );
    }
    case "practice-count":
      return validatePracticeCount(vector.count);
  }
}

describe("boundary vectors (REQ-011; AC-039 through AC-042)", () => {
  it.each(fixture.vectors as unknown as Vector[])("$id → $expect", (vector) => {
    const violations = runVector(vector);
    if (vector.expect === "accept") {
      expect(violations).toEqual([]);
    } else {
      expect(violations.length).toBeGreaterThan(0);
      // Rejection is field-addressable: the violation names the field,
      // the limit, and the actual size.
      expect(violations[0]!.field).toContain(
        vector.field.replace(/\[.*\]/, "")
      );
      // Size violations carry actual > limit; scheme violations reject
      // regardless of length and carry the scheme code instead.
      if (violations[0]!.code === "invalid_url_scheme") {
        expect(vector.kind).toBe("url-explicit");
      } else {
        expect(violations[0]!.actual).toBeGreaterThan(violations[0]!.limit);
      }
    }
  });

  it("counts characters, not encoded bytes (AC-040)", () => {
    const multibyte = "🚀".repeat(fixture.limits.rationaleChars);
    expect(characterCount(multibyte)).toBe(fixture.limits.rationaleChars);
    // 8000 UTF-8 bytes / 4000 UTF-16 units, yet accepted at exactly the
    // character limit.
    expect(new TextEncoder().encode(multibyte).length).toBeGreaterThan(
      fixture.limits.rationaleChars
    );
    expect(validateRationale(multibyte)).toEqual([]);
  });
});

// ─── Atomic, non-destructive rejection (AC-039, AC-041) ─────

describe("atomic rejection (REQ-011; AC-039, AC-041)", () => {
  it("reports every violation at once and never mutates the input", () => {
    const snapshot = {
      title: "Practice",
      questionText: "Question",
      pillarName: "Security",
      templateName: "Template",
      revisionNumber: 1,
      evidenceState: "unmet" as const,
      leadingPractices: [],
      helpfulLinks: Array.from({ length: 11 }, (_, index) => ({
        title: `Link ${index}`,
        url: `${URL_PREFIX}${index}`,
      })),
      evidenceIdentifiers: Array.from(
        { length: 21 },
        (_, index) => `ev-${index}`
      ),
    };
    const before = structuredClone(snapshot);

    const violations = validatePracticeSnapshot(snapshot);
    // Both collection limits surface in one pass — atomic rejection.
    expect(violations.map((v) => v.field)).toEqual(
      expect.arrayContaining(["helpfulLinks", "evidenceIdentifiers"])
    );
    // Nothing truncated, nothing dropped.
    expect(snapshot).toEqual(before);
  });

  it("the domain boundary rejects an over-limit rationale with the same contract the UI validator uses", () => {
    const practice = makeSelectablePractice();
    const rows = selectPractice({
      existing: [],
      practice,
      actorId: "actor-1",
      occurredAt: NOW,
    });
    const overLimit = "a".repeat(HANDOFF_LIMITS.rationaleChars + 1);

    const expected = validateRationale(overLimit);
    let thrown: HandoffLimitError | null = null;
    try {
      setRationale(rows, rows[0]!.id, overLimit);
    } catch (error) {
      thrown = error as HandoffLimitError;
    }
    expect(thrown).toBeInstanceOf(HandoffLimitError);
    // One shared contract: the domain error carries exactly the violations
    // the UI-facing validator computes (no duplicated limit constants).
    expect(thrown!.violations).toEqual(expected);
    // The rejected write never partially persisted.
    expect(rows[0]!.rationale).toBeNull();

    // Selection with an over-limit snapshot is rejected atomically too.
    expect(() =>
      selectPractice({
        existing: [],
        practice: {
          ...practice,
          helpfulLinks: Array.from({ length: 11 }, (_, index) => ({
            title: `L${index}`,
            url: `${URL_PREFIX}${index}`,
          })),
        },
        actorId: "actor-1",
        occurredAt: NOW,
      })
    ).toThrowError(HandoffLimitError);
    // The rejected selection wrote nothing.
    expect(rows).toHaveLength(1);
  });
});

// ─── Confirmation limits (AC-039, AC-042) ───────────────────

describe("confirmation limit enforcement (REQ-011; AC-039, AC-042)", () => {
  it("rejects an over-limit external reference before any transition is planned", () => {
    const result = confirmHandoff({
      practices: [makeReference(0)],
      history: [],
      reference: {
        provider: "gitlab",
        externalId: "x".repeat(HANDOFF_LIMITS.identifierChars + 1),
        url: `${URL_PREFIX}1`,
      },
      actorId: "actor-1",
      occurredAt: NOW,
      transitionIdFor: (id) => `as-${id}`,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("invalid_reference");
    expect(
      (result as { violations: HandoffLimitViolation[] }).violations[0]!.field
    ).toContain("externalId");
  });

  it("rejects unsafe URL schemes in an external reference (AC-039)", () => {
    // The fixture proves the shared validator in both runtimes; this pins
    // the domain confirmation boundary to the same scheme rejection.
    for (const url of [
      "javascript:alert(1)",
      "//example.com/ticket/1",
      "http://example.com/ticket/1",
    ]) {
      const result = confirmHandoff({
        practices: [makeReference(0)],
        history: [],
        reference: { provider: "gitlab", externalId: "TEAM-1", url },
        actorId: "actor-1",
        occurredAt: NOW,
        transitionIdFor: (id) => `as-${id}`,
      });
      expect(result.ok, `${url} must be rejected`).toBe(false);
      if (result.ok) continue;
      expect(result.code).toBe("invalid_reference");
      expect(
        (result as { violations: HandoffLimitViolation[] }).violations.map(
          (v) => v.code
        )
      ).toContain("invalid_url_scheme");
    }
  });

  it("rejects a handoff beyond the 50-practice maximum (AC-042)", () => {
    const practices = Array.from({ length: 51 }, (_, index) =>
      makeReference(index)
    );
    const result = confirmHandoff({
      practices,
      history: [],
      reference: {
        provider: "gitlab",
        externalId: "TEAM-1",
        url: `${URL_PREFIX}1`,
      },
      actorId: "actor-1",
      occurredAt: NOW,
      transitionIdFor: (id) => `as-${id}`,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("practice_limit_exceeded");
  });
});

// ─── Limit-maximal draft fits the push contract (AC-043) ────

describe("limit-maximal draft push contract (REQ-011; AC-043; local-first/AC-021..023)", () => {
  it("a draft at every limit fits the 500-event / 100-field push caps", () => {
    const maximal = fixture.limitMaximalDraft;
    const rationale = "r".repeat(maximal.rationaleChars);

    let rows: HandoffPracticeRecord[] = [];
    for (let index = 0; index < maximal.practiceCount; index++) {
      rows = selectPractice({
        existing: rows,
        practice: {
          ...makeSelectablePractice(index),
          helpfulLinks: Array.from(
            { length: maximal.helpfulLinksPerPractice },
            (_, link) => ({ title: `L${link}`, url: `${URL_PREFIX}${link}` })
          ),
        },
        rationale,
        evidenceIdentifiers: Array.from(
          { length: maximal.evidenceIdentifiersPerPractice },
          (_, ev) => `ev-${ev}`
        ),
        actorId: "actor-1",
        occurredAt: NOW,
      });
    }
    // Every practice at every limit is accepted.
    expect(rows).toHaveLength(maximal.practiceCount);

    const confirmation = confirmHandoff({
      practices: rows.map((row) => row.reference),
      history: [],
      reference: {
        provider: "p".repeat(1),
        externalId: "x".repeat(maximal.identifierChars),
        url: `${URL_PREFIX}${"u".repeat(maximal.urlChars - URL_PREFIX.length)}`,
      },
      actorId: "actor-1",
      occurredAt: NOW,
      transitionIdFor: (id) => `as-${id}`,
    });
    expect(confirmation.ok).toBe(true);
    if (!confirmation.ok) return;

    // Events: one upsert per practice row plus one association transition
    // per practice — far under the 500-event push cap.
    const eventCount = rows.length + confirmation.transitions.length;
    expect(eventCount).toBeLessThanOrEqual(
      fixture.pushContract.maxEventsPerPush
    );
    // Fields per event: serialized rows stay far under the 100-field cap.
    for (const row of rows) {
      expect(Object.keys(handoffPracticeToRow(row)).length).toBeLessThanOrEqual(
        fixture.pushContract.maxFieldsPerEvent
      );
    }
    for (const transition of confirmation.transitions) {
      expect(
        Object.keys(associationTransitionToRow(transition)).length
      ).toBeLessThanOrEqual(fixture.pushContract.maxFieldsPerEvent);
    }
  });
});

// ─── Builders ────────────────────────────────────────────────

function makeReference(index: number) {
  return {
    reviewId: "review-1",
    templateRevisionId: "rev-a",
    questionId: `q-${index}`,
    practiceId: `cl-${index}`,
  };
}

function makeSelectablePractice(index = 0): SelectablePractice {
  const reference = makeReference(index);
  return {
    reference,
    entityId: `review_handoff_practice:${reference.reviewId}/${reference.templateRevisionId}/${reference.questionId}/${reference.practiceId}`,
    title: `Practice ${index}`,
    questionText: `Question ${index}`,
    pillarSlug: "security",
    pillarName: "Security",
    templateName: "Security Review",
    revisionNumber: 1,
    severity: "high",
    evidence: {
      state: "unmet",
      provenance: { kind: "yes-no", answer: "no" },
    },
    leadingPractices: [],
    helpfulLinks: [],
    deepLink: {
      name: "team-review-assessment",
      params: { teamId: "team-1", reviewId: "review-1" },
      query: { templateRevisionId: "rev-a" },
      hash: `#question-${index}`,
    },
    currentAssociation: null,
  };
}
