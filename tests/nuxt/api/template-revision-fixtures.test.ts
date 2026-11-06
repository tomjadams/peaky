import { describe, expect, it } from "vitest";
import type { TemplateRevisionDetail } from "~/models";
import { validateMaturityDefinition } from "~/services/maturity/definition";
import {
  buildDefaultMaturityDefinition,
  scorableQuestionsFromRevision,
} from "~/services/maturity/defaults";
import {
  decodeMaturityDefinition,
  serializeMaturityDefinition,
} from "~/services/maturity/persistence";
import { templateDetails, templates } from "../../../server/data/templates";
import { reviews } from "../../../server/data/reviews";

const SYSTEM_ACTOR_ID = "actor-system";
const details = Object.values(templateDetails);
const detailById = new Map(details.map((detail) => [detail.id, detail]));
const publishedRevisionIds = new Set(
  templates.flatMap((entry) =>
    entry.publishedRevisions.map((revision) => revision.id)
  )
);

function questionIds(detail: TemplateRevisionDetail): Set<string> {
  return new Set(
    detail.pillars.flatMap((pillar) =>
      pillar.questions.map((question) => question.id)
    )
  );
}

describe("deterministic Template Revision fixtures", () => {
  it("provides one complete detail for every advertised Revision identity", () => {
    for (const entry of templates) {
      const revisions = [
        ...(entry.draftRevision ? [entry.draftRevision] : []),
        ...entry.publishedRevisions,
      ];
      for (const revision of revisions) {
        expect(detailById.get(revision.id)).toMatchObject(revision);
      }
    }
  });

  it("gives each published fixture a separate editable draft identity tree", () => {
    const publishedEntries = templates.filter(
      (entry) => entry.publishedRevisions.length > 0
    );
    expect(publishedEntries.length).toBeGreaterThan(0);

    for (const entry of publishedEntries) {
      expect(entry.publishedRevisions).toHaveLength(1);
      expect(entry.draftRevision).not.toBeNull();
      const published = detailById.get(entry.publishedRevisions[0]!.id);
      const draft = entry.draftRevision
        ? detailById.get(entry.draftRevision.id)
        : undefined;
      expect(published).toBeDefined();
      expect(draft).toBeDefined();
      expect(draft?.id).not.toBe(published?.id);

      const publishedPillarIds = new Set(
        published?.pillars.map((pillar) => pillar.id)
      );
      const draftPillarIds = new Set(draft?.pillars.map((pillar) => pillar.id));
      expect(
        [...publishedPillarIds].filter((id) => draftPillarIds.has(id))
      ).toEqual([]);
      const draftQuestionIds = questionIds(draft!);
      expect(
        [...questionIds(published!)].filter((id) => draftQuestionIds.has(id))
      ).toEqual([]);
    }
  });

  it("keeps exactly one draft-only fixture non-selectable", () => {
    const draftOnlyEntries = templates.filter(
      (entry) => entry.publishedRevisions.length === 0
    );
    expect(draftOnlyEntries).toHaveLength(1);
    expect(draftOnlyEntries[0]?.draftRevision?.status).toBe("draft");
    expect(
      publishedRevisionIds.has(draftOnlyEntries[0]!.draftRevision!.id)
    ).toBe(false);
  });

  it("uses Team ownership and status-coupled system provenance", () => {
    for (const entry of templates) {
      expect(entry.template.ownerTeamId).toBeTruthy();
      expect(entry.template.createdByActorId).toBe(SYSTEM_ACTOR_ID);
      expect(entry.template.updatedByActorId).toBe(SYSTEM_ACTOR_ID);
    }

    for (const detail of details) {
      expect(detail.createdByActorId).toBe(SYSTEM_ACTOR_ID);
      expect(detail.updatedByActorId).toBe(SYSTEM_ACTOR_ID);
      if (detail.status === "draft") {
        expect(detail).toMatchObject({
          revisionNumber: null,
          publishedAt: null,
          publishedByActorId: null,
        });
      } else {
        expect(detail.revisionNumber).toBe(1);
        expect(detail.publishedAt).toBeTruthy();
        expect(detail.publishedByActorId).toBe(SYSTEM_ACTOR_ID);
      }
    }
  });

  it("uses globally distinct Revision, Pillar, and Question row identities", () => {
    const revisionIds = details.map((detail) => detail.id);
    const pillarIds = details.flatMap((detail) =>
      detail.pillars.map((pillar) => pillar.id)
    );
    const allQuestionIds = details.flatMap((detail) =>
      detail.pillars.flatMap((pillar) =>
        pillar.questions.map((question) => question.id)
      )
    );

    expect(new Set(revisionIds).size).toBe(revisionIds.length);
    expect(new Set(pillarIds).size).toBe(pillarIds.length);
    expect(new Set(allQuestionIds).size).toBe(allQuestionIds.length);
    for (const detail of details) {
      for (const pillar of detail.pillars) {
        expect(pillar.templateRevisionId).toBe(detail.id);
      }
    }
  });
});

describe("deterministic Review fixture references", () => {
  it("references only exact published Revision identities", () => {
    for (const review of reviews) {
      for (const selection of review.templates) {
        expect(publishedRevisionIds.has(selection.templateRevisionId)).toBe(
          true
        );
        expect(detailById.get(selection.templateRevisionId)?.templateId).toBe(
          selection.templateId
        );
      }
    }
  });

  it("backfills deterministic default maturity definitions on published Revisions (REQ-009; AC-010, AC-044)", () => {
    // Task 2.8: while template writes are frozen, published fixture Revisions
    // carry the configured-default definition so maturity can calculate; the
    // document must reference the re-scoped published content identities.
    for (const entry of templates) {
      for (const summary of entry.publishedRevisions) {
        const detail = detailById.get(summary.id);
        expect(detail, `published Revision ${summary.id}`).toBeDefined();
        const stored = detail!.maturityDefinition;
        expect(
          stored,
          `published Revision ${summary.id} must carry a definition`
        ).toBeTruthy();

        const decoded = decodeMaturityDefinition(stored);
        expect(decoded).not.toBeNull();
        const questions = scorableQuestionsFromRevision(detail!);
        expect(
          questions.length,
          `published Revision ${summary.id} question count`
        ).toBeGreaterThan(0);
        expect(validateMaturityDefinition(decoded!, questions)).toEqual([]);

        // Deterministic backfill: the seeded document is exactly the
        // configured-default document for the pinned content.
        expect(stored).toBe(
          serializeMaturityDefinition(buildDefaultMaturityDefinition(questions))
        );

        // The definition must reference the Revision's own (re-scoped)
        // question identities, never the shared source fixture identities.
        const owned = questionIds(detail!);
        for (const questionId of Object.keys(decoded!.associations.questions)) {
          expect(owned.has(questionId)).toBe(true);
        }
      }
    }
  });

  it("leaves fixture drafts without a frozen maturity definition", () => {
    for (const detail of details) {
      if (detail.status !== "draft") continue;
      expect(detail.maturityDefinition ?? null).toBeNull();
    }
  });

  it("does not mutate Review selections when backfilling definitions", () => {
    const selectionPairs = reviews.flatMap((review) =>
      review.templates.map(
        (selection) => `${review.id}:${selection.templateRevisionId}`
      )
    );
    expect(new Set(selectionPairs).size).toBe(selectionPairs.length);
    for (const review of reviews) {
      for (const selection of review.templates) {
        const detail = detailById.get(selection.templateRevisionId);
        expect(detail?.status).toBe("published");
      }
    }
  });

  it("contains no fabricated templateId-v-1 identities", () => {
    for (const entry of templates) {
      expect(detailById.has(`${entry.template.id}-v-1`)).toBe(false);
    }
    for (const review of reviews) {
      for (const selection of review.templates) {
        expect(selection.templateRevisionId).not.toBe(
          `${selection.templateId}-v-1`
        );
      }
    }
  });
});
