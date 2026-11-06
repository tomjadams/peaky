import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import type * as AnswersModule from "../../../server/data/answers";
import type * as ReviewsModule from "../../../server/data/reviews";
import { findPublishedTemplateRevisionDetail } from "../../../server/data/templates";
import {
  setupNitroStubs,
  resetNitroStubs,
  type NitroStubs,
} from "../helpers/nitro";

// oxlint-disable-next-line no-redundant-type-constituents
type EventHandler = (event: never) => Promise<unknown> | unknown;

// ---------------------------------------------------------------------------
// Seed data IDs — derived from current server/data/ seed state
// ---------------------------------------------------------------------------

// First seed review (in-progress, ORR + PCI-DSS templates)
const REVIEW_ID = "01932b3c-7d00-7000-8000-000000002001";

// Third seed review (multi-template: ORR + PCI-DSS + GDPR)
// Has reliability/resilience (3 questions) and operational ownership (2 questions)
const MULTI_TEMPLATE_REVIEW_ID = "01932b3c-7d00-7000-8000-000000002006";

// Question IDs retained by the ORR replacement template
const orrRevision = findPublishedTemplateRevisionDetail(
  "01932b3c-7d00-7000-8000-000000001001"
)!;
const questionId = (pillarSlug: string, index: number) =>
  orrRevision.pillars.find((pillar) => pillar.slug === pillarSlug)!.questions[
    index
  ]!.id;
const Q_REL_001 = questionId("reliability-resilience", 0);
const Q_REL_002 = questionId("reliability-resilience", 1);
const Q_SEC_001 = questionId("observability-response", 0);
const Q_SEC_003 = questionId("observability-response", 2);
const Q_OPS_001 = questionId("operational-ownership", 0);
const otherRevision = findPublishedTemplateRevisionDetail(
  "01932b3c-7d00-7000-8000-000000001004"
)!;

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

let answersPostHandler: EventHandler;
let progressPutHandler: EventHandler;
let questionsGetHandler: EventHandler;
let questionDetailGetHandler: EventHandler;
let answersStore: typeof AnswersModule;
let reviewsData: typeof ReviewsModule;

describe("Assessment Answer Persistence", () => {
  const stubs: NitroStubs = setupNitroStubs();

  beforeAll(async () => {
    const answersPostModule =
      await import("../../../server/api/reviews/[id]/answers.post");
    const progressPutModule =
      await import("../../../server/api/reviews/[id]/pillars/[pillarId]/progress.put");
    const questionsGetModule =
      await import("../../../server/api/reviews/[id]/questions.get");
    const questionDetailModule =
      await import("../../../server/api/reviews/[id]/questions/[questionId].get");
    answersStore = await import("../../../server/data/answers");
    reviewsData = await import("../../../server/data/reviews");

    answersPostHandler = answersPostModule.default;
    progressPutHandler = progressPutModule.default;
    questionsGetHandler = questionsGetModule.default;
    questionDetailGetHandler = questionDetailModule.default;
  });

  beforeEach(() => {
    resetNitroStubs(stubs);
    answersStore.clearAnswers();
  });

  describe("POST /api/reviews/:id/answers", () => {
    it("returns 400 when review ID is missing", async () => {
      stubs.body.value = {
        templateRevisionId: orrRevision.id,
        questionId: Q_SEC_001,
        answer: "yes",
      };

      await expect(answersPostHandler({} as never)).rejects.toThrow(
        "Review ID is required"
      );
    });

    it("returns 404 when review does not exist", async () => {
      stubs.routerParams = { id: "nonexistent" };
      stubs.body.value = {
        templateRevisionId: orrRevision.id,
        questionId: Q_SEC_001,
        answer: "yes",
      };

      await expect(answersPostHandler({} as never)).rejects.toThrow(
        "Review not found"
      );
    });

    it("returns 400 when questionId is missing", async () => {
      stubs.routerParams = { id: REVIEW_ID };
      stubs.body.value = { answer: "yes" };

      await expect(answersPostHandler({} as never)).rejects.toThrow(
        "questionId is required"
      );
    });

    it("returns 400 when templateRevisionId is missing", async () => {
      stubs.routerParams = { id: REVIEW_ID };
      stubs.body.value = { questionId: Q_SEC_001, answer: "yes" };

      await expect(answersPostHandler({} as never)).rejects.toThrow(
        "templateRevisionId is required"
      );
    });

    it("rejects a Question owned by another selected Revision", async () => {
      stubs.routerParams = { id: REVIEW_ID };
      stubs.body.value = {
        templateRevisionId: otherRevision.id,
        questionId: Q_SEC_001,
        answer: "yes",
      };

      await expect(answersPostHandler({} as never)).rejects.toThrow(
        "Question does not belong"
      );
    });

    it("allows clearing an answer with null", async () => {
      stubs.routerParams = { id: REVIEW_ID };
      stubs.body.value = {
        templateRevisionId: orrRevision.id,
        questionId: Q_SEC_001,
        answer: "yes",
      };
      await answersPostHandler({} as never);

      stubs.body.value = {
        templateRevisionId: orrRevision.id,
        questionId: Q_SEC_001,
        answer: null,
      };
      const result = await answersPostHandler({} as never);
      expect(result).toHaveProperty("success", true);

      const stored = answersStore.getAnswer(REVIEW_ID, Q_SEC_001);
      expect(stored).toBeUndefined();
    });

    it("returns 400 when answer is missing", async () => {
      stubs.routerParams = { id: REVIEW_ID };
      stubs.body.value = {
        templateRevisionId: orrRevision.id,
        questionId: Q_SEC_001,
      };

      await expect(answersPostHandler({} as never)).rejects.toThrow(
        "answer is required"
      );
    });

    it("returns 400 for invalid answer value", async () => {
      stubs.routerParams = { id: REVIEW_ID };
      stubs.body.value = {
        templateRevisionId: orrRevision.id,
        questionId: Q_SEC_001,
        answer: 12345,
      };

      await expect(answersPostHandler({} as never)).rejects.toThrow(
        "Invalid answer"
      );
    });

    it("persists yes answer and returns 200", async () => {
      stubs.routerParams = { id: REVIEW_ID };
      stubs.body.value = {
        templateRevisionId: orrRevision.id,
        questionId: Q_SEC_001,
        answer: "yes",
      };

      const result = await answersPostHandler({} as never);
      expect(result).toHaveProperty("success", true);

      const stored = answersStore.getAnswer(REVIEW_ID, Q_SEC_001);
      expect(stored).toBeDefined();
      expect(stored!.answer).toBe("yes");
    });

    it("persists no answer correctly", async () => {
      stubs.routerParams = { id: REVIEW_ID };
      stubs.body.value = {
        templateRevisionId: orrRevision.id,
        questionId: Q_REL_002,
        answer: "no",
      };

      await answersPostHandler({} as never);

      const stored = answersStore.getAnswer(REVIEW_ID, Q_REL_002);
      expect(stored!.answer).toBe("no");
    });

    it("persists NA answer with reason", async () => {
      stubs.routerParams = { id: REVIEW_ID };
      stubs.body.value = {
        templateRevisionId: orrRevision.id,
        questionId: Q_REL_002,
        answer: "na",
        naReason: { reason: "not-in-scope", comment: "Handled externally" },
      };

      await answersPostHandler({} as never);

      const stored = answersStore.getAnswer(REVIEW_ID, Q_REL_002);
      expect(stored!.answer).toBe("na");
      expect(stored!.naReason).toEqual({
        reason: "not-in-scope",
        comment: "Handled externally",
      });
    });

    it("persists checklist answer with checked and na arrays", async () => {
      stubs.routerParams = { id: REVIEW_ID };
      stubs.body.value = {
        templateRevisionId: orrRevision.id,
        questionId: Q_SEC_003,
        answer: { checked: ["cli-sec-1", "cli-sec-2"], na: ["cli-sec-3"] },
      };

      await answersPostHandler({} as never);

      const stored = answersStore.getAnswer(REVIEW_ID, Q_SEC_003);
      expect(stored!.answer).toEqual({
        checked: ["cli-sec-1", "cli-sec-2"],
        na: ["cli-sec-3"],
      });
    });

    it("persists an explicit empty checklist without clearing the answer", async () => {
      stubs.routerParams = { id: REVIEW_ID };
      stubs.body.value = {
        templateRevisionId: orrRevision.id,
        questionId: Q_SEC_003,
        answer: { checked: [], na: [] },
      };

      await answersPostHandler({} as never);

      const stored = answersStore.getAnswer(REVIEW_ID, Q_SEC_003);
      expect(stored).toBeDefined();
      expect(stored!.answer).toEqual({ checked: [], na: [] });
    });

    it("persists checklist answer as string array", async () => {
      stubs.routerParams = { id: REVIEW_ID };
      stubs.body.value = {
        templateRevisionId: orrRevision.id,
        questionId: Q_SEC_003,
        answer: ["cli-sec-1", "cli-sec-2"],
      };

      await answersPostHandler({} as never);

      const stored = answersStore.getAnswer(REVIEW_ID, Q_SEC_003);
      expect(stored!.answer).toEqual(["cli-sec-1", "cli-sec-2"]);
    });

    it("overwrites previous answer for same question", async () => {
      stubs.routerParams = { id: REVIEW_ID };

      stubs.body.value = {
        templateRevisionId: orrRevision.id,
        questionId: Q_SEC_001,
        answer: "yes",
      };
      await answersPostHandler({} as never);

      stubs.body.value = {
        templateRevisionId: orrRevision.id,
        questionId: Q_SEC_001,
        answer: "no",
      };
      await answersPostHandler({} as never);

      const stored = answersStore.getAnswer(REVIEW_ID, Q_SEC_001);
      expect(stored!.answer).toBe("no");
    });

    it("persists item-level NA reasons", async () => {
      stubs.routerParams = { id: REVIEW_ID };
      stubs.body.value = {
        templateRevisionId: orrRevision.id,
        questionId: Q_SEC_003,
        answer: { checked: ["cli-sec-1"], na: ["cli-sec-3"] },
        itemNAReasons: {
          "cli-sec-3": { reason: "not-in-scope" },
        },
      };

      await answersPostHandler({} as never);

      const stored = answersStore.getAnswer(REVIEW_ID, Q_SEC_003);
      expect(stored!.itemNAReasons).toEqual({
        "cli-sec-3": { reason: "not-in-scope" },
      });
    });

    it("answers persist across multiple HTTP requests", async () => {
      stubs.routerParams = { id: REVIEW_ID };

      stubs.body.value = {
        templateRevisionId: orrRevision.id,
        questionId: Q_SEC_001,
        answer: "yes",
      };
      await answersPostHandler({} as never);

      stubs.body.value = {
        templateRevisionId: orrRevision.id,
        questionId: Q_REL_002,
        answer: "no",
      };
      await answersPostHandler({} as never);

      expect(answersStore.getAnswer(REVIEW_ID, Q_SEC_001)!.answer).toBe("yes");
      expect(answersStore.getAnswer(REVIEW_ID, Q_REL_002)!.answer).toBe("no");
    });

    it("updates pillar answeredQuestions after saving an answer", async () => {
      stubs.routerParams = { id: MULTI_TEMPLATE_REVIEW_ID };
      stubs.body.value = {
        templateRevisionId: orrRevision.id,
        questionId: Q_REL_001,
        answer: "yes",
      };

      await answersPostHandler({} as never);

      const review = reviewsData.reviews.find(
        (r) => r.id === MULTI_TEMPLATE_REVIEW_ID
      );
      const reliabilityPillar = review!.templates
        .flatMap((t) => t.pillars)
        .find((p) => p.slug === "reliability-resilience");
      expect(reliabilityPillar!.answeredQuestions).toBe(1);
    });

    it("updates pillar progress percentage after saving an answer", async () => {
      // Reliability & Resilience has 3 questions
      stubs.routerParams = { id: MULTI_TEMPLATE_REVIEW_ID };

      stubs.body.value = {
        templateRevisionId: orrRevision.id,
        questionId: Q_REL_001,
        answer: "yes",
      };
      await answersPostHandler({} as never);
      stubs.body.value = {
        templateRevisionId: orrRevision.id,
        questionId: Q_REL_002,
        answer: "no",
      };
      await answersPostHandler({} as never);

      const review = reviewsData.reviews.find(
        (r) => r.id === MULTI_TEMPLATE_REVIEW_ID
      );
      const reliabilityPillar = review!.templates
        .flatMap((t) => t.pillars)
        .find((p) => p.slug === "reliability-resilience");
      expect(reliabilityPillar!.answeredQuestions).toBe(2);
      expect(reliabilityPillar!.progress).toBe(67); // 2/3 = 67%
    });

    it("updates multiple pillars when answering questions from different pillars", async () => {
      stubs.routerParams = { id: MULTI_TEMPLATE_REVIEW_ID };

      stubs.body.value = {
        templateRevisionId: orrRevision.id,
        questionId: Q_REL_001,
        answer: "yes",
      };
      await answersPostHandler({} as never);

      stubs.body.value = {
        templateRevisionId: orrRevision.id,
        questionId: Q_OPS_001,
        answer: "no",
      };
      await answersPostHandler({} as never);

      const review = reviewsData.reviews.find(
        (r) => r.id === MULTI_TEMPLATE_REVIEW_ID
      );

      const reliabilityPillar = review!.templates
        .flatMap((t) => t.pillars)
        .find((p) => p.slug === "reliability-resilience");
      expect(reliabilityPillar!.answeredQuestions).toBe(1);
      expect(reliabilityPillar!.progress).toBe(33); // 1/3 = 33%

      const opsPillar = review!.templates
        .flatMap((t) => t.pillars)
        .find((p) => p.slug === "operational-ownership");
      expect(opsPillar!.answeredQuestions).toBe(1);
      expect(opsPillar!.progress).toBe(50); // 1/2 = 50%
    });
  });

  describe("GET /api/reviews/:id/questions (with answers)", () => {
    it("returns saved answers merged into questions", async () => {
      answersStore.setAnswer(REVIEW_ID, Q_REL_001, { answer: "no" });

      stubs.routerParams = { id: REVIEW_ID };

      const result = (await questionsGetHandler({} as never)) as {
        questions: Array<{ id: string; answer: unknown }>;
      };

      const qRel1 = result.questions.find((q) => q.id === Q_REL_001);
      expect(qRel1).toBeDefined();
      expect(qRel1!.answer).toBe("no");
    });

    it("returns null for unanswered questions", async () => {
      stubs.routerParams = { id: REVIEW_ID };

      const result = (await questionsGetHandler({} as never)) as {
        questions: Array<{ id: string; answer: unknown }>;
      };

      const qRel2 = result.questions.find((q) => q.id === Q_REL_002);
      expect(qRel2).toBeDefined();
      expect(qRel2!.answer).toBeNull();
    });

    it("returns naReason from answers store", async () => {
      answersStore.setAnswer(REVIEW_ID, Q_SEC_001, {
        answer: "na",
        naReason: { reason: "legacy-system" },
      });

      stubs.routerParams = { id: REVIEW_ID };

      const result = (await questionsGetHandler({} as never)) as {
        questions: Array<{
          id: string;
          answer: unknown;
          naReason?: unknown;
        }>;
      };

      const qSec1 = result.questions.find((q) => q.id === Q_SEC_001);
      expect(qSec1!.answer).toBe("na");
      expect(qSec1!.naReason).toEqual({ reason: "legacy-system" });
    });

    it("returns checklist answer from answers store", async () => {
      answersStore.setAnswer(REVIEW_ID, Q_SEC_003, {
        answer: { checked: ["cli-sec-1"], na: ["cli-sec-4"] },
      });

      stubs.routerParams = { id: REVIEW_ID };

      const result = (await questionsGetHandler({} as never)) as {
        questions: Array<{ id: string; answer: unknown }>;
      };

      const qSec3 = result.questions.find((q) => q.id === Q_SEC_003);
      expect(qSec3!.answer).toEqual({
        checked: ["cli-sec-1"],
        na: ["cli-sec-4"],
      });
    });
  });

  describe("GET /api/reviews/:id/questions/:questionId (with answers)", () => {
    it("returns saved answer for individual question", async () => {
      answersStore.setAnswer(REVIEW_ID, Q_REL_001, { answer: "yes" });

      stubs.routerParams = { id: REVIEW_ID, questionId: Q_REL_001 };

      const result = (await questionDetailGetHandler({} as never)) as {
        question: { id: string; answer: unknown };
      };

      expect(result.question.answer).toBe("yes");
    });
  });

  describe("PUT /api/reviews/:id/pillars/:pillarSlug/progress", () => {
    it("returns 400 when review ID is missing", async () => {
      stubs.routerParams = { pillarId: "security" };
      stubs.body.value = { progress: 50 };

      await expect(progressPutHandler({} as never)).rejects.toThrow(
        "Review ID is required"
      );
    });

    it("returns 400 when pillar ID is missing", async () => {
      stubs.routerParams = { id: REVIEW_ID };
      stubs.body.value = { progress: 50 };

      await expect(progressPutHandler({} as never)).rejects.toThrow(
        "Pillar ID is required"
      );
    });

    it("returns 404 when review does not exist", async () => {
      stubs.routerParams = { id: "nonexistent", pillarId: "security" };
      stubs.body.value = { progress: 50 };

      await expect(progressPutHandler({} as never)).rejects.toThrow(
        "Review not found"
      );
    });

    it("persists progress and returns 200", async () => {
      stubs.routerParams = {
        id: REVIEW_ID,
        pillarId: "observability-response",
      };
      stubs.body.value = { progress: 75 };

      const result = await progressPutHandler({} as never);
      expect(result).toHaveProperty("success", true);

      const review = reviewsData.reviews.find((r) => r.id === REVIEW_ID);
      const pillar = review!.templates
        .flatMap((t) => t.pillars)
        .find((p) => p.slug === "observability-response");
      expect(pillar!.progress).toBe(75);
    });

    it("persists progress with answeredQuestions and totalQuestions", async () => {
      stubs.routerParams = {
        id: REVIEW_ID,
        pillarId: "observability-response",
      };
      stubs.body.value = {
        progress: 67,
        answeredQuestions: 2,
        totalQuestions: 3,
      };

      const result = await progressPutHandler({} as never);
      expect(result).toHaveProperty("success", true);

      const review = reviewsData.reviews.find((r) => r.id === REVIEW_ID);
      const pillar = review!.templates
        .flatMap((t) => t.pillars)
        .find((p) => p.slug === "observability-response");
      expect(pillar!.progress).toBe(67);
      expect(pillar!.answeredQuestions).toBe(2);
      expect(pillar!.totalQuestions).toBe(3);
    });
  });
});
