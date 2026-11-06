import { describe, it, expect } from "vitest";
import { templateValidation } from "~/services/template/TemplateValidation";
import { templateDetails, templates } from "../../../server/data/templates";

const ORR_TEMPLATE_ID = "01932b3c-7d00-7000-8000-000000001001";
const ORR_PUBLISHED_REVISION_ID = templates.find(
  (entry) => entry.template.id === ORR_TEMPLATE_ID
)!.publishedRevisions[0]!.id;

// NOTE: mostly testing test setup, we'll use MSW for functional testing later
describe("Templates Data", () => {
  describe("templates data structure", () => {
    it("has valid template entries", () => {
      expect(templates.length).toBeGreaterThan(0);
    });

    it("templates have explicit aggregate and Revision fields", () => {
      const entry = templates[0];
      expect(entry?.template).toMatchObject({
        id: ORR_TEMPLATE_ID,
        status: "active",
        ownerTeamId: expect.any(String),
        createdByActorId: expect.any(String),
        updatedByActorId: expect.any(String),
      });
      expect(entry?.draftRevision).toMatchObject({
        templateId: ORR_TEMPLATE_ID,
        status: "draft",
        revisionNumber: null,
      });
      expect(entry?.publishedRevisions).toEqual([
        expect.objectContaining({
          templateId: ORR_TEMPLATE_ID,
          status: "published",
          revisionNumber: 1,
        }),
      ]);
      const revisionId = entry?.publishedRevisions[0]?.id;
      expect(
        revisionId ? entry?.pillarSlugsByRevisionId[revisionId] : []
      ).toHaveLength(4);
    });

    it("Template and Revision statuses are independently valid", () => {
      for (const entry of templates) {
        expect(["active", "archived"]).toContain(entry.template.status);
        if (entry.draftRevision) {
          expect(entry.draftRevision.status).toBe("draft");
        }
        for (const revision of entry.publishedRevisions) {
          expect(["published", "retired"]).toContain(revision.status);
        }
      }
    });

    it("includes expected templates", () => {
      const templateNames = templates.map((entry) => entry.template.name);
      expect(templateNames).toContain("Operational Readiness Review (ORR)");
      expect(templateNames).toContain("PCI-DSS");
      expect(templateNames).toContain("GDPR Audit");
    });

    it("lists ORR first and no longer offers the replaced Peak Season template", () => {
      expect(templates[0]?.template.id).toBe(ORR_TEMPLATE_ID);
      expect(templates.map((entry) => entry.template.name)).not.toContain(
        "Peak Season"
      );
    });

    it("can find the published ORR Revision by Template ID", () => {
      const entry = templates.find(
        (candidate) => candidate.template.id === ORR_TEMPLATE_ID
      );
      expect(entry?.publishedRevisions[0]?.name).toBe(
        "Operational Readiness Review (ORR)"
      );
      expect(entry?.publishedRevisions[0]?.revisionNumber).toBe(1);
    });

    it("seeds the complete publishable ORR checklist", () => {
      const template = templateDetails[ORR_PUBLISHED_REVISION_ID];
      const questions = template?.pillars.flatMap((pillar) => pillar.questions);

      expect(template?.pillars).toHaveLength(4);
      expect(questions).toHaveLength(10);
      expect(
        questions?.reduce(
          (count, question) => count + (question.checklistItems?.length ?? 0),
          0
        )
      ).toBe(179);
      expect(
        questions?.every((question) => question.type === "checklist")
      ).toBe(true);
      expect(templateValidation.validateTemplate(template ?? null)).toEqual([]);
    });

    it("links Feign timeouts to client resiliency guidance", () => {
      const links = templateDetails[ORR_PUBLISHED_REVISION_ID]?.pillars.flatMap(
        (pillar) =>
          pillar.questions.flatMap((question) => question.helpfulLinks)
      );
      const feignLink = links?.find(
        (link) => link.title === "Timeout Configuration for Feign Clients"
      );
      const toxicNetLinks = links?.filter((link) =>
        link.title.startsWith("Simulate Network Conditions")
      );

      expect(feignLink?.url).toContain(
        "/tailor-stack/client/topics/resiliency"
      );
      expect(
        toxicNetLinks?.every((link) => link.url.endsWith("/toxic_net"))
      ).toBe(true);
    });
  });
});
