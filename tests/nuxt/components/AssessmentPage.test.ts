import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/vue";
import { mockNuxtImport } from "@nuxt/test-utils/runtime";
import { computed, nextTick, ref } from "vue";
import AssessmentPage from "~/components/AssessmentPage.vue";

const questionId = "019fae01-9409-704f-9516-fee7a55a848c";
const pillar = {
  slug: "reliability-resilience",
  name: "Reliability & Resilience",
  progress: 0,
  totalQuestions: 1,
  answeredQuestions: 0,
};
const question = {
  id: questionId,
  templateRevisionId: "revision-1",
  pillar: pillar.slug,
  text: "Does the service have a reliability definition?",
  type: "yes-no" as const,
  riskLevel: "medium" as const,
  answer: null,
};
const revisionBQuestionId = "019fae01-9409-704f-9516-fee7a55a848d";
const revisionBPillar = {
  slug: "delivery-safety",
  name: "Delivery safety",
  progress: 0,
  totalQuestions: 1,
  answeredQuestions: 0,
};
const revisionBQuestion = {
  id: revisionBQuestionId,
  templateRevisionId: "revision-2",
  pillar: revisionBPillar.slug,
  text: "Are production changes checked before release?",
  type: "yes-no" as const,
  riskLevel: "high" as const,
  answer: null,
};

const routeState = vi.hoisted(() => ({
  hash: "",
  path: "/teams/team-1/reviews/review-1/assessment",
  query: {} as Record<string, string | string[] | undefined>,
  replace: vi.fn(),
}));

mockNuxtImport("useRoute", () => () => routeState);
mockNuxtImport("useRouter", () => () => ({ replace: routeState.replace }));

vi.mock("~/composables/nav/usePageHeader", () => ({
  usePageHeader: () => ({ setPageHeader: vi.fn(), setCTA: vi.fn() }),
}));
vi.mock("~/ui/useMoreInfoPanel", () => ({
  useMoreInfoPanel: () => ({ openMoreInfoPanel: vi.fn() }),
}));
vi.mock("~/composables/nav/useCommandPalette", () => ({
  useCommandPalette: () => ({ registerCommands: vi.fn(() => vi.fn()) }),
}));
const loadedReview = {
  id: "review-1",
  name: "ORR review",
  orgId: "org-1",
  templateId: "orr",
  templateName: "Operational Readiness Review",
  pillars: [pillar],
  templateIds: ["orr", "delivery"],
  templateNames: ["Operational Readiness Review", "Delivery Review"],
  templates: [
    {
      templateId: "orr",
      templateRevisionId: "revision-1",
      templateName: "Operational Readiness Review",
      revisionNumber: 1,
      revisionSummary: null,
      progress: 0,
      pillars: [pillar],
    },
    {
      templateId: "delivery",
      templateRevisionId: "revision-2",
      templateName: "Delivery Review",
      revisionNumber: 2,
      revisionSummary: null,
      progress: 0,
      pillars: [revisionBPillar],
    },
  ],
  status: "in-progress" as const,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};
const reviewState = ref<typeof loadedReview | null>(loadedReview);
const questionsState = ref([question, revisionBQuestion]);
const pendingState = ref(false);
const activeTemplateRevisionId = ref<string | null>("revision-1");
const activePillarSlug = ref<string | null>(pillar.slug);
const currentPillarState = ref<typeof pillar | typeof revisionBPillar | null>(
  pillar
);
const activePillars = computed(() =>
  activeTemplateRevisionId.value === "revision-2" ? [revisionBPillar] : [pillar]
);
const currentPillarIndex = computed(() =>
  activePillars.value.findIndex(
    (candidate) => candidate.slug === currentPillarState.value?.slug
  )
);
const setActiveTemplateRevision = vi.fn((revisionId: string | null) => {
  activeTemplateRevisionId.value = revisionId;
});
const setActivePillar = vi.fn((slug: string | null) => {
  activePillarSlug.value = slug;
});
const goToPillarBySlug = vi.fn((slug: string) => {
  currentPillarState.value =
    [pillar, revisionBPillar].find((candidate) => candidate.slug === slug) ??
    null;
});
const getQuestionsForPillar = vi.fn((slug: string) =>
  questionsState.value.filter(
    (candidate) =>
      candidate.templateRevisionId === activeTemplateRevisionId.value &&
      candidate.pillar === slug
  )
);

vi.mock("~/ui/useTemplateSelector", () => ({
  useTemplateSelector: () => ({
    isCollapsed: ref(false),
    activeTemplateRevisionId,
    activePillarSlug,
    setActiveTemplateRevision,
    setActivePillar,
  }),
}));
vi.mock("~/composables/assessment/useAssessment", () => ({
  useAssessment: () => ({
    review: reviewState,
    pending: pendingState,
    error: ref(null),
    pillars: activePillars,
    questions: questionsState,
    currentPillar: currentPillarState,
    currentPillarIndex,
    nextPillar: vi.fn(),
    prevPillar: vi.fn(),
    goToPillarBySlug,
    getQuestionsForPillar,
    handleAnswer: vi.fn(),
    handleItemNAConfirm: vi.fn(),
    handleItemNAClear: vi.fn(),
    overallProgress: ref(0),
    answeredCount: ref(0),
    totalQuestionCount: ref(2),
    saveAnswer: vi.fn(),
    createMilestone: vi.fn(),
  }),
}));
vi.mock("~/composables/assessment/useNAHandlers", () => ({
  useNAHandlers: () => ({
    handleAnswerChange: vi.fn(),
    handleNAClick: vi.fn(),
    handleItemNAClick: vi.fn(),
    onNAConfirm: vi.fn(),
    onNAClear: vi.fn(),
  }),
}));
vi.mock("~/ui/useSaveModal", () => ({
  useSaveModal: () => ({ open: vi.fn() }),
}));

function renderAssessment(options: { stubSidebar?: boolean } = {}) {
  return render(AssessmentPage, {
    props: { reviewId: "review-1" },
    global: {
      stubs: {
        TemplateSelectorSidebar: options.stubSidebar ?? true,
        AssessmentPillarSection: { template: "<section><slot /></section>" },
        AssessmentQuestionRow: {
          props: ["questionId", "questionLabel"],
          template:
            '<article :id="`question-${questionId}`" tabindex="-1" :data-storage-id="questionId">{{ questionLabel }}</article>',
        },
        NAReasonModal: true,
        SaveProgressModal: true,
      },
    },
  });
}

describe("AssessmentPage", () => {
  beforeEach(() => {
    routeState.hash = "";
    routeState.query = {};
    routeState.replace.mockReset();
    routeState.replace.mockImplementation(
      async (replacement: {
        query: Record<string, string | string[] | undefined>;
        hash: string;
      }) => {
        routeState.query = replacement.query;
        routeState.hash = replacement.hash;
      }
    );
    reviewState.value = loadedReview;
    questionsState.value = [question, revisionBQuestion];
    pendingState.value = false;
    activeTemplateRevisionId.value = "revision-1";
    activePillarSlug.value = pillar.slug;
    currentPillarState.value = pillar;
    setActiveTemplateRevision.mockClear();
    setActivePillar.mockClear();
    goToPillarBySlug.mockClear();
    getQuestionsForPillar.mockClear();
  });
  afterEach(() => cleanup());

  it("derives REL-1 from the pillar position without exposing the UUID", () => {
    renderAssessment();

    expect(screen.getByText("REL-1")).toBeDefined();
    expect(screen.queryByText(questionId)).toBeNull();
    expect(
      document
        .querySelector("[data-storage-id]")
        ?.getAttribute("data-storage-id")
    ).toBe(questionId);
  });

  it("selects a valid query-only Revision before its Questions load", async () => {
    questionsState.value = [];
    routeState.query = { templateRevisionId: "revision-2" };

    renderAssessment();

    await waitFor(() => {
      expect(setActiveTemplateRevision).toHaveBeenCalledWith("revision-2");
      expect(activeTemplateRevisionId.value).toBe("revision-2");
      expect(goToPillarBySlug).toHaveBeenCalledWith(revisionBPillar.slug);
    });
    expect(routeState.replace).not.toHaveBeenCalled();
  });

  it("lets an exact Question hand off from the queried Revision to another pinned Revision", async () => {
    routeState.query = { templateRevisionId: "revision-1" };
    routeState.hash = `#question-${revisionBQuestionId}`;

    renderAssessment();

    await waitFor(() => {
      expect(setActiveTemplateRevision).toHaveBeenCalledWith("revision-2");
      expect(routeState.replace).toHaveBeenCalledWith({
        query: { templateRevisionId: "revision-2" },
        hash: `#question-${revisionBQuestionId}`,
      });
      expect(goToPillarBySlug).toHaveBeenCalledWith(revisionBPillar.slug);
      expect(document.activeElement?.id).toBe(
        `question-${revisionBQuestionId}`
      );
    });
  });

  it("infers Revision B from a unique Question and synchronizes a missing query", async () => {
    routeState.hash = `#question-${revisionBQuestionId}`;

    renderAssessment();

    await waitFor(() => {
      expect(setActiveTemplateRevision).toHaveBeenCalledWith("revision-2");
      expect(routeState.replace).toHaveBeenCalledWith({
        query: { templateRevisionId: "revision-2" },
        hash: `#question-${revisionBQuestionId}`,
      });
      expect(document.activeElement?.id).toBe(
        `question-${revisionBQuestionId}`
      );
    });
  });

  it("keeps a valid Revision query but rejects an unknown Question hash", async () => {
    routeState.query = { templateRevisionId: "revision-2" };
    routeState.hash = "#question-missing-question";

    renderAssessment();

    await waitFor(() => {
      expect(activeTemplateRevisionId.value).toBe("revision-2");
      expect(goToPillarBySlug).toHaveBeenCalledWith(revisionBPillar.slug);
    });
    expect(routeState.replace).not.toHaveBeenCalled();
    expect(document.activeElement?.id).not.toBe("question-missing-question");
  });

  it("does not focus or hand off an ambiguous Question hash", async () => {
    const ambiguousId = "question-shared-by-revisions";
    questionsState.value = [
      { ...question, id: ambiguousId },
      { ...revisionBQuestion, id: ambiguousId },
    ];
    routeState.query = { templateRevisionId: "revision-1" };
    routeState.hash = `#question-${ambiguousId}`;

    renderAssessment();

    await nextTick();
    await nextTick();

    expect(activeTemplateRevisionId.value).toBe("revision-1");
    expect(routeState.replace).not.toHaveBeenCalled();
    expect(document.activeElement?.id).not.toBe(`question-${ambiguousId}`);
  });

  it("replaces the Revision query and clears a stale hash after sidebar selection", async () => {
    routeState.query = { templateRevisionId: "revision-1" };
    routeState.hash = `#question-${questionId}`;
    renderAssessment({ stubSidebar: false });

    await fireEvent.click(
      screen.getByRole("button", { name: /Delivery Review.*v2/i })
    );

    await waitFor(() => {
      expect(activeTemplateRevisionId.value).toBe("revision-2");
      expect(currentPillarState.value?.slug).toBe(revisionBPillar.slug);
      expect(routeState.replace).toHaveBeenCalledWith({
        query: { templateRevisionId: "revision-2" },
        hash: "",
      });
    });
  });

  it("retries a cross-Revision Question after Review and Question data arrive", async () => {
    reviewState.value = null;
    questionsState.value = [];
    pendingState.value = true;
    routeState.query = { templateRevisionId: "revision-1" };
    routeState.hash = `#question-${revisionBQuestionId}`;

    renderAssessment({ stubSidebar: false });
    expect(
      screen.getByRole("complementary", { name: "Template navigation" })
    ).toBeDefined();

    reviewState.value = loadedReview;
    await nextTick();
    expect(activeTemplateRevisionId.value).toBe("revision-1");
    expect(routeState.replace).not.toHaveBeenCalled();

    questionsState.value = [question, revisionBQuestion];
    pendingState.value = false;

    await waitFor(() => {
      expect(activeTemplateRevisionId.value).toBe("revision-2");
      expect(routeState.replace).toHaveBeenCalledWith({
        query: { templateRevisionId: "revision-2" },
        hash: `#question-${revisionBQuestionId}`,
      });
      expect(document.activeElement?.id).toBe(
        `question-${revisionBQuestionId}`
      );
    });
  });

  it("does not follow a Question hash when its explicit Revision query is invalid", async () => {
    routeState.query = { templateRevisionId: "revision-missing" };
    routeState.hash = `#question-${revisionBQuestionId}`;

    renderAssessment();

    await waitFor(() => {
      expect(screen.getByText("REL-1")).toBeDefined();
    });
    expect(setActiveTemplateRevision).not.toHaveBeenCalledWith("revision-2");
    expect(routeState.replace).not.toHaveBeenCalled();
    expect(document.activeElement?.id).not.toBe(
      `question-${revisionBQuestionId}`
    );
  });
});
