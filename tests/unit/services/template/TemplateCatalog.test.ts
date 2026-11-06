import { expect, it } from "vitest";
import type { TemplateCatalogEntry } from "~/models";
import {
  canEditTemplateDraftFromSnapshot,
  mergeTemplateCatalogEntries,
} from "~/services/template/TemplateCatalog";

const template = {
  id: "template-1",
  name: "Operational Readiness",
  description: "Published metadata",
  status: "active" as const,
  ownerTeamId: "team-platform",
  createdByActorId: "actor-system",
  updatedByActorId: "actor-system",
  createdAt: "2026-08-20T10:00:00Z",
  updatedAt: "2026-08-20T10:00:00Z",
};

it.each([
  ["missing snapshot", null, false],
  [
    "wildcard grant",
    {
      entitlements: JSON.stringify({
        "template:*": { canEdit: true, canView: true },
      }),
      validUntil: null,
    },
    true,
  ],
  [
    "specific grant",
    {
      entitlements: JSON.stringify({
        "template:template-1": { canEdit: true, canView: true },
      }),
      validUntil: "2026-08-21T12:00:00.000Z",
    },
    true,
  ],
  [
    "different Template grant",
    {
      entitlements: JSON.stringify({
        "template:template-2": { canEdit: true, canView: true },
      }),
      validUntil: null,
    },
    false,
  ],
  [
    "malformed expiry",
    {
      entitlements: JSON.stringify({
        "template:*": { canEdit: true, canView: true },
      }),
      validUntil: "not-a-date",
    },
    false,
  ],
  [
    "expired grant",
    {
      entitlements: JSON.stringify({
        "template:*": { canEdit: true, canView: true },
      }),
      validUntil: "2026-08-21T09:59:59.000Z",
    },
    false,
  ],
])("resolves %s fail-closed", (_label, snapshot, expected) => {
  expect(
    canEditTemplateDraftFromSnapshot(
      snapshot as never,
      "template-1",
      new Date("2026-08-21T10:00:00.000Z")
    )
  ).toBe(expected);
});

it("keeps published Revisions available when a local draft overlays the Template", () => {
  const remote: TemplateCatalogEntry = {
    template,
    draftRevision: null,
    publishedRevisions: [
      {
        id: "revision-published-1",
        templateId: template.id,
        name: "Published snapshot",
        description: "Immutable",
        status: "published",
        revisionNumber: 1,
        revisionSummary: "Initial publication",
        publishedAt: "2026-08-20T10:00:00Z",
      },
    ],
    pillarSlugsByRevisionId: {
      "revision-published-1": ["reliability"],
    },
    reviewsCount: 4,
  };
  const local: TemplateCatalogEntry = {
    template: {
      ...template,
      description: "Locally edited aggregate metadata",
      updatedAt: "2026-08-20T11:00:00Z",
    },
    draftRevision: {
      id: "revision-draft-2",
      templateId: template.id,
      name: "Draft snapshot",
      description: "Mutable",
      status: "draft",
      revisionNumber: null,
      revisionSummary: null,
      publishedAt: null,
    },
    publishedRevisions: [],
    pillarSlugsByRevisionId: {
      "revision-draft-2": ["reliability", "operations"],
    },
    reviewsCount: 0,
    canEditDraft: true,
  };

  expect(mergeTemplateCatalogEntries(remote, local)).toEqual({
    ...remote,
    template: local.template,
    draftRevision: local.draftRevision,
    publishedRevisions: remote.publishedRevisions,
    canEditDraft: true,
    pillarSlugsByRevisionId: {
      ...remote.pillarSlugsByRevisionId,
      ...local.pillarSlugsByRevisionId,
    },
  });
});
