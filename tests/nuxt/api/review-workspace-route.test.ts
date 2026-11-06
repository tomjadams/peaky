import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { reviews } from "../../../server/data/reviews";
import { isChecklistWithNAAnswer } from "~/models/question";

const auth = vi.hoisted(() => ({
  getLifecycleActor: vi.fn(),
}));

vi.mock("../../../server/utils/lifecycleActor", () => auth);

type WorkspaceHandler =
  (typeof import("../../../server/api/reviews/[id]/workspace.get"))["default"];

const REVIEW_ID = "01932b3c-7d00-7000-8000-000000002001";

const createErrorStub = (input: {
  statusCode: number;
  statusMessage: string;
}) => Object.assign(new Error(input.statusMessage), input);

let handler: WorkspaceHandler;

beforeAll(async () => {
  vi.stubGlobal("defineEventHandler", (value: unknown) => value);
  handler = (await import("../../../server/api/reviews/[id]/workspace.get"))
    .default;
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("getRouterParam", () => REVIEW_ID);
  vi.stubGlobal("createError", createErrorStub);
  auth.getLifecycleActor.mockResolvedValue({
    id: "00u-authenticated-user",
    name: "Authenticated User",
    roles: ["member"],
  });
});

afterAll(() => {
  vi.unstubAllGlobals();
});

it("requires authentication before returning the demo workspace", async () => {
  const event = {} as never;
  const workspace = await handler(event);

  expect(auth.getLifecycleActor).toHaveBeenCalledWith(event);
  expect(workspace.review.id).toBe(REVIEW_ID);
  expect(workspace.capabilities.canEdit).toBe(true);
  expect(workspace.answers.length).toBeGreaterThan(0);
});

it("keeps seeded Review progress and workspace answer coverage aligned per Revision", async () => {
  const workspace = await handler({} as never);
  const review = reviews.find((candidate) => candidate.id === REVIEW_ID)!;

  for (const template of review.templates) {
    const questionIds = new Set(
      workspace.pillars
        .filter(
          (pillar) => pillar.templateRevisionId === template.templateRevisionId
        )
        .flatMap((pillar) => pillar.questions.map((question) => question.id))
    );
    const workspaceAnswered = workspace.answers.filter(
      (answer) => questionIds.has(answer.questionId) && answer.answer !== null
    ).length;
    const reviewAnswered = template.pillars.reduce(
      (total, pillar) => total + pillar.answeredQuestions,
      0
    );

    expect(workspaceAnswered).toBe(reviewAnswered);
  }
});

it("leaves enough answered checklist gaps to exercise Follow-ups", async () => {
  const workspace = await handler({} as never);
  const checklistById = new Map(
    workspace.pillars.flatMap((pillar) =>
      pillar.questions
        .filter((question) => question.type === "checklist")
        .map((question) => [question.id, question] as const)
    )
  );
  const partialChecklists = workspace.answers.flatMap((answer) => {
    const question = checklistById.get(answer.questionId);
    if (!question || !isChecklistWithNAAnswer(answer.answer)) return [];
    const total = question.checklistItems?.length ?? 0;
    const resolved = new Set([...answer.answer.checked, ...answer.answer.na]);
    return resolved.size < total ? [{ resolved: resolved.size, total }] : [];
  });
  const unresolved = partialChecklists.reduce(
    (total, checklist) => total + checklist.total - checklist.resolved,
    0
  );

  expect(partialChecklists).toHaveLength(2);
  expect(unresolved).toBeGreaterThanOrEqual(20);
});

it("returns no workspace when authentication fails", async () => {
  const unauthorized = Object.assign(new Error("Unauthorized"), {
    statusCode: 401,
  });
  auth.getLifecycleActor.mockRejectedValue(unauthorized);

  await expect(handler({} as never)).rejects.toBe(unauthorized);
});
