import { describe, expect, it } from "vitest";
import { toTemplateSummary } from "~/composables/local/useLocalTemplateDrafts";

describe("toTemplateSummary", () => {
  it("retains draft Revision Pillar slugs for the review template selector", () => {
    const template = {
      id: "template-orr",
      name: "Operational Readiness Review (ORR)",
      status: "active",
      description: "Operational readiness",
      createdAt: "2026-07-30T00:00:00.000Z",
      updatedAt: "2026-07-30T00:00:00.000Z",
    } as Parameters<typeof toTemplateSummary>[0];
    const revision = {
      id: "revision-orr-draft",
      templateId: template.id,
      status: "draft",
      revisionNumber: null,
    } as Parameters<typeof toTemplateSummary>[1];

    const summary = toTemplateSummary(
      template,
      revision,
      new Map([
        [
          revision.id,
          [
            "reliability-resilience",
            "observability-response",
            "change-release-safety",
            "operational-ownership",
          ],
        ],
      ])
    );

    expect(summary.draftRevision?.id).toBe("revision-orr-draft");
    expect(summary.publishedRevisions).toEqual([]);
    expect(summary.pillarSlugsByRevisionId["revision-orr-draft"]).toHaveLength(
      4
    );
    expect(summary.pillarSlugsByRevisionId["revision-orr-draft"]).toContain(
      "reliability-resilience"
    );
  });
});
