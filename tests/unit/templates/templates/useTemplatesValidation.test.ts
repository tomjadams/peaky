import { describe, it, expect } from "vitest";
import {
  useTemplatesValidation,
  CHAR_LIMITS,
} from "~/composables/templates/useTemplatesValidation";
import type { TemplateRevisionDetail } from "~/models";
import { HANDOFF_LIMITS } from "~/services/handoff/limits";

const makeTemplate = (
  overrides?: Partial<TemplateRevisionDetail>
): TemplateRevisionDetail => ({
  id: "revision-1",
  templateId: "template-1",
  name: "Test Template",
  status: "draft",
  revisionNumber: null,
  revisionSummary: null,
  description: "A test template",
  createdByActorId: "actor-system",
  updatedByActorId: "actor-system",
  publishedByActorId: null,
  createdAt: "2026-08-20T10:00:00Z",
  updatedAt: "2026-08-20T10:00:00Z",
  publishedAt: null,
  pillars: [
    {
      id: "pillar-security",
      templateRevisionId: "revision-1",
      slug: "security",
      name: "Security",
      description: "",
      order: 1,
      questions: [
        {
          id: "q-1",
          order: 1,
          text: "Is auth configured?",
          riskLevel: "high",
          importance: "Prevents unauthorized access",
          leadingPractices: [{ id: "lp-1", order: 1, text: "Use OAuth2" }],
          helpfulLinks: [],
        },
      ],
    },
  ],
  ...overrides,
});

describe("useTemplatesValidation", () => {
  const { validateTemplate, getQuestionSlug } = useTemplatesValidation();

  describe("validateTemplate", () => {
    it("should return empty errors for valid template", () => {
      const errors = validateTemplate(makeTemplate());
      expect(errors).toEqual([]);
    });

    it("should return empty errors for null template", () => {
      const errors = validateTemplate(null);
      expect(errors).toEqual([]);
    });

    it("should detect question text exceeding limit", () => {
      const template = makeTemplate();
      template.pillars[0].questions[0].text = "x".repeat(
        CHAR_LIMITS.questionText + 1
      );
      const errors = validateTemplate(template);
      expect(errors.length).toBe(1);
      expect(errors[0]).toContain("Question text too long");
    });

    it("should detect importance exceeding limit", () => {
      const template = makeTemplate();
      template.pillars[0].questions[0].importance = "x".repeat(
        CHAR_LIMITS.importance + 1
      );
      const errors = validateTemplate(template);
      expect(errors.length).toBe(1);
      expect(errors[0]).toContain("Why This Matters");
    });

    it("should detect practice exceeding limit", () => {
      const template = makeTemplate();
      template.pillars[0].questions[0].leadingPractices[0].text = "x".repeat(
        CHAR_LIMITS.practice + 1
      );
      const errors = validateTemplate(template);
      expect(errors.length).toBe(1);
      expect(errors[0]).toContain("Leading practice #1 too long");
    });

    it("rejects questions that cannot fit the handoff helpful-link contract", () => {
      const template = makeTemplate();
      template.pillars[0].questions[0].helpfulLinks = Array.from(
        { length: HANDOFF_LIMITS.helpfulLinksPerPractice + 1 },
        (_, index) => ({
          id: `link-${index}`,
          title: `Link ${index}`,
          url: `https://example.com/${index}`,
        })
      );

      expect(validateTemplate(template)[0]).toContain(
        `Helpful links must contain at most ${HANDOFF_LIMITS.helpfulLinksPerPractice}`
      );
    });

    it("allows checklists with more than five items", () => {
      const template = makeTemplate();
      template.pillars[0].questions[0] = {
        ...template.pillars[0].questions[0],
        type: "checklist",
        checklistItems: Array.from({ length: 20 }, (_, index) => ({
          id: `item-${index + 1}`,
          order: index + 1,
          text: `Maturity check ${index + 1}`,
        })),
      };

      expect(validateTemplate(template)).toEqual([]);
    });

    it("requires at least three checklist items", () => {
      const template = makeTemplate();
      template.pillars[0].questions[0] = {
        ...template.pillars[0].questions[0],
        type: "checklist",
        checklistItems: [
          { id: "item-1", order: 1, text: "First check" },
          { id: "item-2", order: 2, text: "Second check" },
        ],
      };

      expect(validateTemplate(template)[0]).toContain(
        "Checklist requires at least 3 leading practices"
      );
    });

    it("rejects checklist items exceeding their character limit", () => {
      const template = makeTemplate();
      template.pillars[0].questions[0] = {
        ...template.pillars[0].questions[0],
        type: "checklist",
        checklistItems: [
          {
            id: "item-1",
            order: 1,
            text: "x".repeat(CHAR_LIMITS.checklistItem + 1),
          },
          { id: "item-2", order: 2, text: "Second check" },
          { id: "item-3", order: 3, text: "Third check" },
        ],
      };

      expect(validateTemplate(template)[0]).toContain(
        "Leading practice #1 too long"
      );
    });
  });

  describe("getQuestionSlug", () => {
    it("should generate slug from pillar and order", () => {
      expect(getQuestionSlug("security", 1)).toBe("SEC-1");
      expect(getQuestionSlug("reliability", 3)).toBe("REL-3");
    });
  });
});
