import { describe, it, expect, beforeEach } from "vitest";
import { usePageHeader } from "~/composables/nav/usePageHeader";

describe("usePageHeader", async () => {
  beforeEach(() => {
    const { setPageHeader } = usePageHeader();
    setPageHeader({ title: "", showSurveyMode: false });
  });

  describe("initial state", () => {
    it("should have empty title initially", () => {
      const { title } = usePageHeader();
      expect(title.value).toBe("");
    });

    it("should have showSurveyMode false initially", () => {
      const { showSurveyMode } = usePageHeader();
      expect(showSurveyMode.value).toBe(false);
    });
  });

  describe("setPageHeader", () => {
    it("should set the page title", () => {
      const { setPageHeader, title } = usePageHeader();

      setPageHeader({ title: "My Page Title" });

      expect(title.value).toBe("My Page Title");
    });

    it("should set showSurveyMode when provided", () => {
      const { setPageHeader, showSurveyMode } = usePageHeader();

      setPageHeader({ title: "Assessment", showSurveyMode: true });

      expect(showSurveyMode.value).toBe(true);
    });

    it("should default showSurveyMode to false when not provided", () => {
      const { setPageHeader, showSurveyMode } = usePageHeader();

      // First set it to true
      setPageHeader({ title: "Page 1", showSurveyMode: true });
      expect(showSurveyMode.value).toBe(true);

      // Then set without showSurveyMode - should default to false
      setPageHeader({ title: "Page 2" });
      expect(showSurveyMode.value).toBe(false);
    });

    it("should update both title and showSurveyMode together", () => {
      const { setPageHeader, title, showSurveyMode } = usePageHeader();

      setPageHeader({ title: "Review Assessment", showSurveyMode: true });

      expect(title.value).toBe("Review Assessment");
      expect(showSurveyMode.value).toBe(true);
    });
  });

  describe("shared state", () => {
    it("should share state across multiple composable calls", () => {
      const first = usePageHeader();
      const second = usePageHeader();

      first.setPageHeader({ title: "Shared Title", showSurveyMode: true });

      expect(second.title.value).toBe("Shared Title");
      expect(second.showSurveyMode.value).toBe(true);
    });
  });

  describe("readonly refs", () => {
    it("should return readonly showSurveyMode", () => {
      const { showSurveyMode } = usePageHeader();
      expect(typeof showSurveyMode.value).toBe("boolean");
    });
  });
});
