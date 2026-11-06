import { describe, it, expect, beforeEach } from "vitest";
import { useAssessmentNavigation } from "~/composables/assessment/useAssessmentNavigation";
import type { Pillar } from "~/models";

describe("useAssessmentNavigation", () => {
  const mockPillars: Pillar[] = [
    {
      slug: "security",
      name: "Security",
      progress: 50,
      totalQuestions: 5,
      answeredQuestions: 2,
    },
    {
      slug: "reliability",
      name: "Reliability",
      progress: 75,
      totalQuestions: 4,
      answeredQuestions: 3,
    },
    {
      slug: "performance",
      name: "Performance",
      progress: 0,
      totalQuestions: 3,
      answeredQuestions: 0,
    },
  ];

  let pillarsRef: Ref<Pillar[]>;
  let nav: ReturnType<typeof useAssessmentNavigation>;

  beforeEach(() => {
    pillarsRef = ref([...mockPillars]);
    nav = useAssessmentNavigation(pillarsRef);
  });

  describe("currentPillar", () => {
    it("should start at first pillar", () => {
      expect(nav.currentPillar.value?.slug).toBe("security");
    });

    it("should return null for empty pillars", () => {
      pillarsRef.value = [];
      expect(nav.currentPillar.value).toBeNull();
    });
  });

  describe("currentPillarIndex", () => {
    it("should start at 0", () => {
      expect(nav.currentPillarIndex.value).toBe(0);
    });
  });

  describe("nextPillar", () => {
    it("should advance to next pillar", () => {
      nav.nextPillar();
      expect(nav.currentPillar.value?.slug).toBe("reliability");
    });

    it("should not go past last pillar", () => {
      nav.nextPillar();
      nav.nextPillar();
      nav.nextPillar(); // Should stay at index 2
      expect(nav.currentPillarIndex.value).toBe(2);
    });
  });

  describe("prevPillar", () => {
    it("should go to previous pillar", () => {
      nav.nextPillar();
      nav.prevPillar();
      expect(nav.currentPillar.value?.slug).toBe("security");
    });

    it("should not go below 0", () => {
      nav.prevPillar();
      expect(nav.currentPillarIndex.value).toBe(0);
    });
  });

  describe("goToPillar", () => {
    it("should navigate to specific index", () => {
      nav.goToPillar(2);
      expect(nav.currentPillar.value?.slug).toBe("performance");
    });

    it("should ignore invalid index", () => {
      nav.goToPillar(-1);
      expect(nav.currentPillarIndex.value).toBe(0);

      nav.goToPillar(99);
      expect(nav.currentPillarIndex.value).toBe(0);
    });
  });

  describe("goToPillarBySlug", () => {
    it("should navigate by slug", () => {
      nav.goToPillarBySlug("reliability");
      expect(nav.currentPillarIndex.value).toBe(1);
    });

    it("should ignore unknown slug", () => {
      nav.goToPillarBySlug("nonexistent");
      expect(nav.currentPillarIndex.value).toBe(0);
    });
  });
});
