import { describe, expect, it } from "vitest";
import type { WorkspacePillar } from "~/models/workspace";
import { calculatePillarEvidenceProgress } from "~/services/review/pillarEvidenceProgress";

const checklist = (questionId: string, count: number) => ({
  id: questionId,
  templateRevisionId: "rev-1",
  pillarId: "pillar-observability",
  orderKey: questionId,
  text: questionId,
  type: "checklist" as const,
  checklistItems: Array.from({ length: count }, (_, index) => ({
    id: `${questionId}-${index + 1}`,
    order: index + 1,
    text: `Item ${index + 1}`,
  })),
});

const answer = (questionId: string, checked: number) => ({
  questionId,
  answer: {
    checked: Array.from(
      { length: checked },
      (_, index) => `${questionId}-${index + 1}`
    ),
    na: [],
  },
  updatedAt: "2026-09-03T09:00:00.000Z",
});

describe("calculatePillarEvidenceProgress", () => {
  it("counts resolved checklist items rather than answered questions", () => {
    const pillar: WorkspacePillar = {
      id: "pillar-observability",
      templateRevisionId: "rev-1",
      slug: "observability",
      name: "Observability & Response",
      orderKey: "1",
      questions: [
        checklist("OBS-1", 20),
        checklist("OBS-2", 18),
        checklist("OBS-3", 15),
      ],
    };

    expect(
      calculatePillarEvidenceProgress(pillar, [
        answer("OBS-1", 17),
        answer("OBS-2", 18),
        answer("OBS-3", 2),
      ])
    ).toEqual({ completed: 37, total: 53, percent: 70 });
  });
});
