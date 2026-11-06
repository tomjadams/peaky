import { expect, it } from "vitest";
import type { ReviewWorkspace } from "~/models/workspace";
import { workspaceToAssessmentData } from "~/services/assessment/AssessmentOrchestrator";

const workspace = {
  review: {
    id: "review-1",
    name: "Composite Review",
    status: "in-progress",
    templateRevisionIds: ["revision-1", "revision-2"],
    createdAt: "2026-08-21T10:00:00Z",
    updatedAt: "2026-08-21T10:00:00Z",
  },
  subject: { id: "team-1", type: "team", name: "Team", slug: "team" },
  templateRevisions: [
    {
      id: "revision-1",
      templateId: "template-1",
      name: "Revision One",
      revisionNumber: 1,
      revisionSummary: null,
      position: 0,
    },
    {
      id: "revision-2",
      templateId: "template-2",
      name: "Revision Two",
      revisionNumber: 1,
      revisionSummary: null,
      position: 1,
    },
  ],
  pillars: [
    {
      id: "pillar-1",
      templateRevisionId: "revision-1",
      slug: "security",
      name: "Security One",
      orderKey: "0001",
      questions: [
        {
          id: "question-1",
          templateRevisionId: "revision-1",
          pillarId: "pillar-1",
          orderKey: "0001",
          text: "First question",
          type: "yes-no",
        },
      ],
    },
    {
      id: "pillar-2",
      templateRevisionId: "revision-2",
      slug: "security",
      name: "Security Two",
      orderKey: "0001",
      questions: [
        {
          id: "question-2",
          templateRevisionId: "revision-2",
          pillarId: "pillar-2",
          orderKey: "0001",
          text: "Second question",
          type: "yes-no",
        },
      ],
    },
  ],
  answers: [
    {
      questionId: "question-2",
      answer: "yes",
      updatedAt: "2026-08-21T10:00:00Z",
    },
  ],
  notes: [],
  attachments: [],
  scores: [],
  assessors: [],
  advisors: [],
  capabilities: {},
  recentHistory: [],
  answerProvenance: {},
} as unknown as ReviewWorkspace;

it("hydrates every exact selected Revision without merging equal Pillar slugs", () => {
  const result = workspaceToAssessmentData(workspace);

  expect(
    result.reviewOverlay?.templates.map((template) => ({
      revisionId: template.templateRevisionId,
      pillarKey: template.pillars[0]?.key,
    }))
  ).toEqual([
    { revisionId: "revision-1", pillarKey: "revision-1::security" },
    { revisionId: "revision-2", pillarKey: "revision-2::security" },
  ]);
  expect(
    result.questionsOverlay?.questions.map((question) => ({
      id: question.id,
      revisionId: question.templateRevisionId,
      pillarKey: question.pillarKey,
      answer: question.answer,
    }))
  ).toEqual([
    {
      id: "question-1",
      revisionId: "revision-1",
      pillarKey: "revision-1::security",
      answer: null,
    },
    {
      id: "question-2",
      revisionId: "revision-2",
      pillarKey: "revision-2::security",
      answer: "yes",
    },
  ]);
});
