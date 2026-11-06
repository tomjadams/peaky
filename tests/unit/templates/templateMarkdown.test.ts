import { describe, expect, it } from "vitest";
import type { TemplateRevisionDetail } from "~/models";
import {
  parseTemplateMarkdown,
  templateToMarkdown,
} from "~/utils/templateMarkdown";

const checklistItems = Array.from({ length: 7 }, (_, index) => ({
  id: `item-${index + 1}`,
  order: index + 1,
  text: `Maturity check ${index + 1}`,
}));

const template: TemplateRevisionDetail = {
  id: "revision-1",
  templateId: "template-1",
  name: "Operational Readiness Review (ORR)",
  status: "published",
  revisionNumber: 1,
  revisionSummary: null,
  description: "Quarterly operational readiness review.",
  createdByActorId: "actor-system",
  updatedByActorId: "actor-system",
  publishedByActorId: "actor-system",
  createdAt: "2026-08-20T10:00:00Z",
  updatedAt: "2026-08-20T10:00:00Z",
  publishedAt: "2026-08-20T10:00:00Z",
  pillars: [
    {
      id: "pillar-reliability",
      templateRevisionId: "revision-1",
      slug: "reliability",
      name: "Reliability",
      order: 1,
      questions: [
        {
          id: "question-1",
          order: 1,
          type: "checklist",
          text: "How mature is your reliability definition?",
          riskLevel: "medium",
          importance: "Reliability targets make readiness measurable.",
          checklistItems,
          leadingPractices: [
            { id: "practice-1", order: 1, text: "Review quarterly" },
          ],
          helpfulLinks: [
            {
              id: "link-1",
              order: 1,
              title: "Reliability [guide] & notes",
              url: "https://example.com/reliability(a)",
            },
          ],
        },
      ],
    },
  ],
};

describe("template markdown", () => {
  it("round-trips checklist type and items", () => {
    const markdown = templateToMarkdown(template);

    expect(markdown).toContain("**Type:** checklist");
    expect(markdown).toContain("**Checklist Items:**");
    expect(markdown).toContain("- Maturity check 7");

    const parsed = parseTemplateMarkdown(markdown);
    const question = parsed?.pillars?.[0]?.questions[0];

    expect(question?.type).toBe("checklist");
    expect(question?.checklistItems).toHaveLength(7);
    expect(question?.checklistItems?.map((item) => item.text)).toEqual(
      checklistItems.map((item) => item.text)
    );
    expect(question?.leadingPractices[0]?.text).toBe("Review quarterly");
    expect(question?.helpfulLinks[0]).toMatchObject({
      title: "Reliability [guide] & notes",
      url: "https://example.com/reliability(a)",
    });
  });

  it("defaults legacy markdown without a type to yes-no", () => {
    const parsed = parseTemplateMarkdown(`
# Template: Legacy

## Pillar: Reliability

### Question 1 [Medium]

Is failover tested?
`);

    expect(parsed?.pillars?.[0]?.questions[0]).toMatchObject({
      type: "yes-no",
      checklistItems: [],
    });
  });

  it("rejects legacy Markdown containing Template Rules", () => {
    expect(() =>
      parseTemplateMarkdown(`
# Template: Legacy Rules

## Pillar: Reliability

### Question 1 [Medium]

Is failover tested?

## Rules

### Rule: Escalate reliability
`)
    ).toThrowError(
      'Template Rules are no longer supported. Remove the "## Rules" section and try again.'
    );
  });

  it("preserves explicit question order and bold-prefixed text", () => {
    const parsed = parseTemplateMarkdown(`
# Template: Ordered

## Pillar: Reliability

### Question 7 [Medium]

**Important:** Is failover tested?
`);
    const question = parsed!.pillars![0]!.questions[0]!;

    expect(question.order).toBe(7);
    expect(question.text).toBe("**Important:** Is failover tested?");
  });
});
