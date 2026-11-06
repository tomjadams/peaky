/**
 * Copy-text handoff renderer (improvement-plans/REQ-009, REQ-012;
 * AC-034, AC-044, AC-045).
 *
 * The renderer turns the synchronized draft snapshot (group 5) into one
 * ordered, provider-neutral plain-text payload: derived label and review
 * context first, then every practice in draft order with title, source
 * TemplateRevision and question context, evidence state, rationale,
 * helpful links, and an absolute assessment deep link.
 */
import { describe, expect, it } from "vitest";
import {
  deriveHandoffDraft,
  reorderPractice,
  selectPractice,
  setRationale,
  type HandoffDraft,
  type HandoffPracticeRecord,
} from "~/services/handoff/draft";
import {
  HandoffRenderError,
  renderHandoffMarkdown,
  type HandoffRenderContext,
} from "~/services/handoff/copyText";
import type { SelectablePractice } from "~/services/handoff/projection";

const NOW = "2026-09-10T10:00:00.000Z";
const ORIGIN = "https://peaky.example.com";

function makePractice(
  overrides: Partial<{
    questionId: string;
    practiceId: string;
    title: string;
    questionText: string;
    templateName: string;
    templateRevisionId: string;
    revisionNumber: number | null;
    helpfulLinks: readonly { title: string; url: string }[];
  }> = {}
): SelectablePractice {
  const questionId = overrides.questionId ?? "q-1";
  const practiceId = overrides.practiceId ?? questionId;
  const templateRevisionId = overrides.templateRevisionId ?? "rev-a";
  const reference = {
    reviewId: "review-1",
    templateRevisionId,
    questionId,
    practiceId,
  };
  return {
    reference,
    entityId: `review_handoff_practice:review-1/${templateRevisionId}/${questionId}/${practiceId}`,
    title: overrides.title ?? `Practice ${practiceId}`,
    questionText: overrides.questionText ?? `Question ${questionId}`,
    pillarSlug: "security",
    pillarName: "Security",
    templateName: overrides.templateName ?? "Security Review",
    revisionNumber:
      overrides.revisionNumber === undefined ? 2 : overrides.revisionNumber,
    severity: "high",
    evidence: {
      state: "unmet",
      provenance: { kind: "checklist-item", checked: false },
    },
    leadingPractices: [],
    helpfulLinks: overrides.helpfulLinks ?? [],
    deepLink: {
      name: "team-review-assessment",
      params: { teamId: "team-1", reviewId: "review-1" },
      query: { templateRevisionId },
      hash: `#question-${questionId}`,
    },
    currentAssociation: null,
  };
}

function makeRows(
  practices: readonly SelectablePractice[]
): HandoffPracticeRecord[] {
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

/** Route-style deep-link path, as the caller resolves it from the router. */
const practicePath: HandoffRenderContext["practicePath"] = (practice) => {
  const { reviewId, templateRevisionId, questionId } =
    practice.record.reference;
  return `/teams/team-1/reviews/${reviewId}/assessment?templateRevisionId=${templateRevisionId}#question-${questionId}`;
};

const CONTEXT: HandoffRenderContext = {
  origin: ORIGIN,
  reviewPath: "/teams/team-1/reviews/review-1",
  practicePath,
};

function readyDraft(rows: HandoffPracticeRecord[]): HandoffDraft {
  const draft = deriveHandoffDraft(rows, {
    reviewId: "review-1",
    reviewName: "Q3 Readiness",
  });
  if (draft.kind !== "ready") throw new Error("expected a ready draft");
  return draft;
}

describe("renderHandoffMarkdown (improvement-plans/REQ-012)", () => {
  it("renders label, review context, and full per-practice blocks in draft order (AC-034, AC-044)", () => {
    let rows = makeRows([
      makePractice({
        questionId: "q-1",
        practiceId: "cl-a",
        title: "Enable branch protection on release repositories",
        questionText: "Are release repositories protected?",
        helpfulLinks: [
          { title: "Hardening guide", url: "https://example.com/guide" },
        ],
      }),
      // No rationale, no links, and no Revision number: absent context
      // leaves no placeholder line behind.
      makePractice({
        questionId: "q-2",
        title: "Rotate signing keys quarterly",
        questionText: "How are signing keys managed?",
        templateName: "Platform Review",
        templateRevisionId: "rev-b",
        revisionNumber: null,
      }),
    ]);
    rows = setRationale(
      rows,
      rows[0]!.id,
      "Legacy repos still allow direct pushes.",
      NOW
    );

    const text = renderHandoffMarkdown(readyDraft(rows), CONTEXT);

    // The derived label leads: user-directed copy is not a provider
    // payload (AC-044), and the label stays derived — the renderer never
    // accepts a title override (AC-026). Deep links are absolute URLs
    // built from the caller-supplied origin.
    expect(text).toBe(
      [
        "# Q3 Readiness — 2 selected practices",
        "",
        "[Open review](<https://peaky.example.com/teams/team-1/reviews/review-1>)",
        "",
        "## Summary",
        "",
        "| # | Area needing attention | Pillar | Source |",
        "| ---: | --- | --- | --- |",
        "| 1 | Enable branch protection on release repositories | Security | Security Review · revision 2 |",
        "| 2 | Rotate signing keys quarterly | Security | Platform Review |",
        "",
        "## Details",
        "",
        "### 1. Enable branch protection on release repositories",
        "",
        "- **Source:** Security Review · revision 2",
        "- **Pillar:** Security",
        "- **Question:** Are release repositories protected?",
        "- **Evidence:** Area needing attention",
        "- **Note:** Legacy repos still allow direct pushes.",
        "- **Resources:**",
        "  - [Hardening guide](<https://example.com/guide>)",
        "- **Assessment:** [Open question](<https://peaky.example.com/teams/team-1/reviews/review-1/assessment?templateRevisionId=rev-a#question-q-1>)",
        "",
        "### 2. Rotate signing keys quarterly",
        "",
        "- **Source:** Platform Review",
        "- **Pillar:** Security",
        "- **Question:** How are signing keys managed?",
        "- **Evidence:** Area needing attention",
        "- **Assessment:** [Open question](<https://peaky.example.com/teams/team-1/reviews/review-1/assessment?templateRevisionId=rev-b#question-q-2>)",
      ].join("\n")
    );
  });

  it("follows the current draft order after a reorder (AC-044)", () => {
    const rows = makeRows([
      makePractice({ practiceId: "cl-a", title: "A" }),
      makePractice({ practiceId: "cl-b", title: "B" }),
      makePractice({ practiceId: "cl-c", title: "C" }),
    ]);
    const reordered = reorderPractice(rows, rows[2]!.id, 0);

    const text = renderHandoffMarkdown(readyDraft(reordered), CONTEXT);

    expect([...text.matchAll(/^### \d+\. (.+)$/gm)].map((m) => m[1])).toEqual([
      "C",
      "A",
      "B",
    ]);
  });

  it("renders provider-neutral Markdown without provider-specific assumptions (AC-034)", () => {
    const draft = readyDraft(
      makeRows([
        makePractice({
          title: "Enable branch protection",
          helpfulLinks: [{ title: "Guide", url: "https://example.com/guide" }],
        }),
      ])
    );

    const text = renderHandoffMarkdown(draft, CONTEXT);

    expect(text).toMatch(/^# Q3 Readiness/m);
    expect(text).toContain("## Summary");
    expect(text).toContain("| # | Area needing attention | Pillar | Source |");
    expect(text).toContain("- **Resources:**");
    expect(text).toContain("[Guide](<https://example.com/guide>)");
    expect(text).not.toContain("<script");
    expect(text.toLowerCase()).not.toContain("jira");
  });

  it("omits the review link when no review path is supplied", () => {
    const draft = readyDraft(makeRows([makePractice({ title: "A" })]));

    const text = renderHandoffMarkdown(draft, { origin: ORIGIN, practicePath });

    expect(text).not.toContain("[Open review]");
    expect(text).toContain(
      `- **Assessment:** [Open question](<${ORIGIN}/teams/team-1/reviews/review-1/assessment`
    );
  });

  it("refuses an empty draft and names the adding action (AC-027, AC-045)", () => {
    const draft = deriveHandoffDraft([], {
      reviewId: "review-1",
      reviewName: "Q3 Readiness",
    });
    expect(draft.kind).toBe("empty");

    expect(() => renderHandoffMarkdown(draft, CONTEXT)).toThrowError(
      HandoffRenderError
    );
    expect(() => renderHandoffMarkdown(draft, CONTEXT)).toThrowError(
      /Select practices from the improvement plan/
    );
  });

  it("never mutates the draft snapshot (AC-045)", () => {
    const draft = readyDraft(
      makeRows([
        makePractice({ title: "A" }),
        makePractice({ practiceId: "cl-b", title: "B" }),
      ])
    );
    const before = JSON.stringify(draft);

    renderHandoffMarkdown(draft, CONTEXT);

    expect(JSON.stringify(draft)).toBe(before);
  });
});
