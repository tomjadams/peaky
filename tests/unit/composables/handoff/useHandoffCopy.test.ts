/**
 * useHandoffCopy — the primary, always-available handoff control
 * (improvement-plans/REQ-009, REQ-012; AC-034, AC-035, AC-045).
 *
 * A user-directed clipboard write of the ordered, provider-neutral
 * plain-text draft rendering: plain text only, success confirmation or a
 * copy-failure state, and the draft is never altered. Handoff controls are
 * never gated by a public flag, so the composable reads no runtime config;
 * the guard in tests/guards/handoff-provider-boundary.test.ts proves no
 * provider capability key reaches client code (AC-035).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { useHandoffCopy } from "~/composables/handoff/useHandoffCopy";
import {
  deriveHandoffDraft,
  selectPractice,
  type HandoffDraft,
  type HandoffPracticeRecord,
} from "~/services/handoff/draft";
import type { SelectablePractice } from "~/services/handoff/projection";

const NOW = "2026-09-10T10:00:00.000Z";

const writeTextMock = vi.fn<(text: string) => Promise<void>>();

beforeEach(() => {
  writeTextMock.mockReset();
  writeTextMock.mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText: writeTextMock } });
});

afterEach(() => vi.unstubAllGlobals());

function makePractice(title: string, questionId: string): SelectablePractice {
  const reference = {
    reviewId: "review-1",
    templateRevisionId: "rev-a",
    questionId,
    practiceId: questionId,
  };
  return {
    reference,
    entityId: `review_handoff_practice:review-1/rev-a/${questionId}/${questionId}`,
    title,
    questionText: `Question ${questionId}`,
    pillarSlug: "security",
    pillarName: "Security",
    templateName: "Security Review",
    revisionNumber: 2,
    severity: "high",
    evidence: { state: "unmet", provenance: { kind: "yes-no", answer: "no" } },
    leadingPractices: [],
    helpfulLinks: [],
    deepLink: {
      name: "team-review-assessment",
      params: { teamId: "team-1", reviewId: "review-1" },
      query: { templateRevisionId: "rev-a" },
      hash: `#question-${questionId}`,
    },
    currentAssociation: null,
  };
}

function readyDraft(titles: string[]): HandoffDraft {
  let rows: HandoffPracticeRecord[] = [];
  titles.forEach((title, index) => {
    rows = selectPractice({
      existing: rows,
      practice: makePractice(title, `q-${index + 1}`),
      actorId: "actor-1",
      occurredAt: NOW,
    });
  });
  return deriveHandoffDraft(rows, {
    reviewId: "review-1",
    reviewName: "Q3 Readiness",
  });
}

function makeCopy(draft: HandoffDraft) {
  return useHandoffCopy({
    draft: ref(draft),
    reviewPath: "/teams/team-1/reviews/review-1",
    practicePath: (practice) => {
      const { reviewId, templateRevisionId, questionId } =
        practice.record.reference;
      return `/teams/team-1/reviews/${reviewId}/assessment?templateRevisionId=${templateRevisionId}#question-${questionId}`;
    },
  });
}

describe("useHandoffCopy (improvement-plans/REQ-012)", () => {
  it("writes the rendered Markdown to the clipboard and confirms (AC-045)", async () => {
    const draft = readyDraft(["Enable branch protection"]);
    const { status, failureReason, canCopy, copy } = makeCopy(draft);

    expect(canCopy.value).toBe(true);
    expect(status.value).toBe("idle");

    const ok = await copy();

    expect(ok).toBe(true);
    expect(status.value).toBe("copied");
    expect(failureReason.value).toBeNull();
    expect(writeTextMock).toHaveBeenCalledOnce();

    const text = writeTextMock.mock.calls[0]![0];
    expect(text.startsWith("# Q3 Readiness — 1 selected practice\n")).toBe(
      true
    );
    expect(text).toContain("## Summary");
    expect(text).toContain(
      `- **Assessment:** [Open question](<${window.location.origin}/teams/team-1/reviews/review-1/assessment?templateRevisionId=rev-a#question-q-1>)`
    );
  });

  it("surfaces a copy-failure state when the clipboard write rejects (AC-045)", async () => {
    writeTextMock.mockRejectedValue(new Error("NotAllowedError"));
    const draft = readyDraft(["Enable branch protection"]);
    const { status, failureReason, copy } = makeCopy(draft);

    const ok = await copy();

    expect(ok).toBe(false);
    expect(status.value).toBe("failed");
    expect(failureReason.value!.toLowerCase()).toContain("copy");
  });

  it("recovers to the success confirmation on a later copy (AC-045)", async () => {
    writeTextMock.mockRejectedValueOnce(new Error("denied"));
    const draft = readyDraft(["A"]);
    const { status, copy } = makeCopy(draft);

    await copy();
    expect(status.value).toBe("failed");

    await copy();
    expect(status.value).toBe("copied");
  });

  it("never alters the draft on success or failure (AC-045)", async () => {
    const draft = readyDraft(["A", "B"]);
    const before = JSON.stringify(draft);

    await makeCopy(draft).copy();

    writeTextMock.mockRejectedValueOnce(new Error("denied"));
    await makeCopy(draft).copy();

    expect(JSON.stringify(draft)).toBe(before);
  });

  it("refuses an empty draft without touching the clipboard (AC-027, AC-045)", async () => {
    const draft = deriveHandoffDraft([], {
      reviewId: "review-1",
      reviewName: "Q3 Readiness",
    });
    const { status, failureReason, canCopy, copy } = makeCopy(draft);

    expect(canCopy.value).toBe(false);

    const ok = await copy();

    expect(ok).toBe(false);
    expect(writeTextMock).not.toHaveBeenCalled();
    expect(status.value).toBe("failed");
    // The failure names the action that adds practices (AC-027).
    expect(failureReason.value).toContain(
      "Select practices from the improvement plan"
    );
  });
});
