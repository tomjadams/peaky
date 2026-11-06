import { describe, expect, it } from "vitest";
import {
  assertDraftRevisionMutable,
  assertOwnerTeamUnchanged,
  assertTemplateProvenance,
  assertTemplateRevisionState,
  initializeDraftRevision,
  initializeTemplate,
  normalizeRevisionSummary,
  toTemplateRevisionSummary,
  updateDraftRevisionMetadata,
  updateTemplateMetadata,
  TemplateWriteUnavailableError,
} from "~/services/template/TemplateRevisionContracts";
import type {
  ActorId,
  TeamId,
  TemplateId,
  TemplateRevision,
  TemplateRevisionId,
} from "~/models";

const templateId = "template-1" as TemplateId;
const revisionId = "revision-1" as TemplateRevisionId;
const creatorId = "actor-creator" as ActorId;
const editorId = "actor-editor" as ActorId;
const ownerTeamId = "team-platform" as TeamId;
const createdAt = "2026-08-19T10:00:00.000Z";
const updatedAt = "2026-08-19T11:00:00.000Z";

const published = {
  status: "published" as const,
  revisionNumber: 1,
  publishedAt: "2026-08-19T12:00:00.000Z",
  publishedByActorId: "actor-publisher",
};

describe("Template and draft Revision initialization", () => {
  it("initializes stable Template identity and provenance", () => {
    expect(
      initializeTemplate({
        id: templateId,
        name: "Operational Readiness",
        description: "Current metadata",
        ownerTeamId,
        actorId: creatorId,
        now: createdAt,
      })
    ).toEqual({
      id: templateId,
      name: "Operational Readiness",
      description: "Current metadata",
      status: "active",
      ownerTeamId,
      createdByActorId: creatorId,
      updatedByActorId: creatorId,
      createdAt,
      updatedAt: createdAt,
    });
  });

  it("initializes a draft Revision with null publication metadata", () => {
    expect(
      initializeDraftRevision({
        id: revisionId,
        templateId,
        name: "Operational Readiness",
        description: "Draft metadata",
        actorId: creatorId,
        now: createdAt,
        revisionSummary: "   ",
      })
    ).toEqual({
      id: revisionId,
      templateId,
      name: "Operational Readiness",
      description: "Draft metadata",
      status: "draft",
      revisionNumber: null,
      revisionSummary: null,
      createdByActorId: creatorId,
      updatedByActorId: creatorId,
      publishedByActorId: null,
      createdAt,
      updatedAt: createdAt,
      publishedAt: null,
    });
  });

  it("maps a complete Revision to a catalog summary without provenance duplication", () => {
    const revision = initializeDraftRevision({
      id: revisionId,
      templateId,
      name: "Operational Readiness",
      description: "Draft metadata",
      actorId: creatorId,
      now: createdAt,
    });
    expect(toTemplateRevisionSummary(revision)).toEqual({
      id: revisionId,
      templateId,
      name: "Operational Readiness",
      description: "Draft metadata",
      status: "draft",
      revisionNumber: null,
      revisionSummary: null,
      publishedAt: null,
    });
  });

  it.each([
    ["Template owner Team", { ownerTeamId: "" as TeamId, actorId: creatorId }],
    ["Template actor", { ownerTeamId, actorId: "" as ActorId }],
  ])("rejects missing %s provenance", (_label, values) => {
    expect(() =>
      initializeTemplate({
        id: templateId,
        name: "Operational Readiness",
        description: "Current metadata",
        ownerTeamId: values.ownerTeamId,
        actorId: values.actorId,
        now: createdAt,
      })
    ).toThrow(/required/);
  });
});

describe("Template aggregate metadata mutation", () => {
  const template = initializeTemplate({
    id: templateId,
    name: "Original",
    description: "Original description",
    ownerTeamId,
    actorId: creatorId,
    now: createdAt,
  });

  it("preserves creator and owner while advancing updater provenance", () => {
    expect(
      updateTemplateMetadata(
        template,
        { name: "Updated", description: "Updated description" },
        editorId,
        updatedAt
      )
    ).toEqual({
      ...template,
      name: "Updated",
      description: "Updated description",
      updatedByActorId: editorId,
      updatedAt,
    });
  });

  it("accepts the unchanged owner Team", () => {
    expect(
      updateTemplateMetadata(template, { ownerTeamId }, editorId, updatedAt)
        .ownerTeamId
    ).toBe(ownerTeamId);
  });

  it("rejects ownership transfer before mutation", () => {
    expect(() =>
      updateTemplateMetadata(
        template,
        { ownerTeamId: "team-other" as TeamId },
        editorId,
        updatedAt
      )
    ).toThrow(/immutable/);
    expect(template.ownerTeamId).toBe(ownerTeamId);
  });
});

describe("draft Revision metadata mutation", () => {
  const draft = initializeDraftRevision({
    id: revisionId,
    templateId,
    name: "Original",
    description: "Original description",
    actorId: creatorId,
    now: createdAt,
  });

  it("normalizes summary and advances only mutable updater provenance", () => {
    expect(
      updateDraftRevisionMetadata(
        draft,
        {
          name: "Updated",
          description: "Updated description",
          revisionSummary: "  Candidate release  ",
        },
        editorId,
        updatedAt
      )
    ).toEqual({
      ...draft,
      name: "Updated",
      description: "Updated description",
      revisionSummary: "Candidate release",
      updatedByActorId: editorId,
      updatedAt,
    });
  });

  it.each(["published", "retired"] as const)(
    "rejects %s metadata mutation without changing the snapshot",
    (status) => {
      const immutable: TemplateRevision = {
        ...draft,
        status,
        revisionNumber: 1,
        publishedAt: updatedAt,
        publishedByActorId: creatorId,
      };
      expect(() =>
        updateDraftRevisionMetadata(
          immutable,
          { name: "Must not change" },
          editorId,
          updatedAt
        )
      ).toThrow(/immutable/);
      expect(immutable.name).toBe("Original");
    }
  );
});

describe("normalizeRevisionSummary", () => {
  it.each([
    [undefined, null],
    [null, null],
    ["", null],
    ["   ", null],
    ["  Initial publication  ", "Initial publication"],
  ])("normalizes %j to %j", (input, expected) => {
    expect(normalizeRevisionSummary(input)).toBe(expected);
  });

  it("rejects summaries longer than 120 normalized characters", () => {
    expect(() => normalizeRevisionSummary("x".repeat(121))).toThrow(
      /120 characters/
    );
  });
});

describe("assertTemplateRevisionState", () => {
  it("accepts a draft without publication metadata", () => {
    expect(() =>
      assertTemplateRevisionState({
        status: "draft",
        revisionNumber: null,
        publishedAt: null,
        publishedByActorId: null,
      })
    ).not.toThrow();
  });

  it.each(["published", "retired"] as const)(
    "accepts a complete %s publication tuple",
    (status) => {
      expect(() =>
        assertTemplateRevisionState({ ...published, status })
      ).not.toThrow();
    }
  );

  it.each([
    { ...published, revisionNumber: null },
    { ...published, revisionNumber: 0 },
    { ...published, revisionNumber: 1.5 },
    { ...published, publishedAt: null },
    { ...published, publishedByActorId: null },
    {
      status: "draft" as const,
      revisionNumber: 1,
      publishedAt: null,
      publishedByActorId: null,
    },
  ])("rejects an invalid publication tuple %#", (state) => {
    expect(() => assertTemplateRevisionState(state)).toThrow(
      /publication metadata/
    );
  });
});

describe("assertDraftRevisionMutable", () => {
  it("accepts draft mutation", () => {
    expect(() => assertDraftRevisionMutable("draft")).not.toThrow();
  });

  it.each(["published", "retired"] as const)(
    "rejects %s Revision mutation",
    (status) => {
      expect(() => assertDraftRevisionMutable(status)).toThrow(/immutable/);
    }
  );
});

describe("Template provenance", () => {
  it("accepts complete ownership and actor provenance", () => {
    expect(() =>
      assertTemplateProvenance({
        ownerTeamId: "team-platform",
        createdByActorId: "actor-creator",
        updatedByActorId: "actor-creator",
      })
    ).not.toThrow();
  });

  it.each([
    [
      "ownerTeamId",
      {
        ownerTeamId: "",
        createdByActorId: "creator",
        updatedByActorId: "creator",
      },
    ],
    [
      "createdByActorId",
      {
        ownerTeamId: "team",
        createdByActorId: "",
        updatedByActorId: "creator",
      },
    ],
    [
      "updatedByActorId",
      {
        ownerTeamId: "team",
        createdByActorId: "creator",
        updatedByActorId: "",
      },
    ],
  ])("rejects missing %s", (_field, provenance) => {
    expect(() => assertTemplateProvenance(provenance)).toThrow(/required/);
  });

  it("rejects ownership transfer", () => {
    expect(() => assertOwnerTeamUnchanged("team-a", "team-b")).toThrow(
      /immutable/
    );
  });
});

describe("TemplateWriteUnavailableError", () => {
  it("provides the stable fail-closed code", () => {
    const error = new TemplateWriteUnavailableError();
    expect(error.code).toBe("template_write_unavailable");
  });
});
