import { getTableName } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as LocalDb from "~/local-db";
import { ReviewMutations } from "~/services/entity/ReviewMutations";

const mocks = vi.hoisted(() => ({
  commit: vi.fn(),
  draft: vi.fn(),
}));

vi.mock("~/services/local-mutation", () => ({
  localMutation: {
    commit: mocks.commit,
    draft: mocks.draft,
  },
}));

vi.mock("~/services/events/createEvent", () => ({
  createEvent: vi.fn(() => ({
    id: "event-1",
    type: "ReviewCreated.v1",
    time: "2026-08-21T10:00:00.000Z",
    data: {},
  })),
}));

vi.mock("~/services/sync/syncClock", () => ({
  getHLCClock: () => ({ now: () => "1000:0001:actor-1" }),
}));

vi.mock("~/local-db", async (importOriginal) => {
  const actual = await importOriginal<typeof LocalDb>();
  return {
    ...actual,
    createUuidV7: vi.fn(() => "review-1"),
    nowISO: vi.fn(() => "2026-08-21T10:00:00.000Z"),
  };
});

const templates = [
  { id: "template-a", status: "active" },
  { id: "template-b", status: "active" },
  { id: "template-c", status: "active" },
  { id: "template-archived", status: "archived" },
];

const revisions = [
  {
    id: "revision-a",
    templateId: "template-a",
    status: "published",
    revisionNumber: 1,
  },
  {
    id: "revision-a-other",
    templateId: "template-a",
    status: "published",
    revisionNumber: 2,
  },
  {
    id: "revision-b",
    templateId: "template-b",
    status: "published",
    revisionNumber: 1,
  },
  {
    id: "revision-c",
    templateId: "template-c",
    status: "published",
    revisionNumber: 1,
  },
  {
    id: "revision-draft",
    templateId: "template-b",
    status: "draft",
    revisionNumber: null,
  },
  {
    id: "revision-retired",
    templateId: "template-c",
    status: "retired",
    revisionNumber: 1,
  },
  {
    id: "revision-archived",
    templateId: "template-archived",
    status: "published",
    revisionNumber: 1,
  },
];

function installTransaction() {
  const writes: { table: string; values: unknown }[] = [];
  mocks.commit.mockImplementation(async ({ stateWrite }) => {
    const fakeTx = {
      select: () => ({
        from: (table: Parameters<typeof getTableName>[0]) => ({
          where: () => {
            const tableName = getTableName(table);
            const rows =
              tableName === "template_revisions"
                ? revisions
                : tableName === "templates"
                  ? templates
                  : tableName === "subjects"
                    ? [{ id: "product-1", type: "product" }]
                    : [];
            return Object.assign(Promise.resolve(rows), {
              limit: () => Promise.resolve(rows),
              orderBy: () => Promise.resolve(rows),
            });
          },
        }),
      }),
      insert: (table: Parameters<typeof getTableName>[0]) => ({
        values: async (values: unknown) => {
          writes.push({ table: getTableName(table), values });
        },
      }),
    };
    await stateWrite(fakeTx as never, {
      now: "2026-08-21T10:00:00.000Z",
    });
    return { eventId: "event-1" };
  });
  return writes;
}

function createReview(templateRevisionIds: string[]) {
  return new ReviewMutations().create({
    subjectId: "product-1",
    subjectType: "product",
    name: "Readiness Review",
    templateRevisionIds,
    scope: "product",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("local Review Revision selection", () => {
  it("accepts explicitly named exact Revision IDs", async () => {
    const writes = installTransaction();

    await new ReviewMutations().create({
      subjectId: "product-1",
      subjectType: "product",
      name: "Readiness Review",
      templateRevisionIds: ["revision-a"],
      scope: "product",
    } as never);

    expect(writes[1]).toMatchObject({
      table: "review_template_selections",
      values: [
        expect.objectContaining({
          templateRevisionId: "revision-a",
          position: 0,
        }),
      ],
    });
  });

  it("atomically stores one to three ordered composite-key selections", async () => {
    const writes = installTransaction();

    await createReview(["revision-a", "revision-b", "revision-c"]);

    expect(writes).toEqual([
      expect.objectContaining({ table: "reviews" }),
      {
        table: "review_template_selections",
        values: [
          expect.objectContaining({
            reviewId: "review-1",
            templateRevisionId: "revision-a",
            position: 0,
          }),
          expect.objectContaining({
            reviewId: "review-1",
            templateRevisionId: "revision-b",
            position: 1,
          }),
          expect.objectContaining({
            reviewId: "review-1",
            templateRevisionId: "revision-c",
            position: 2,
          }),
        ],
      },
    ]);
    expect(writes[1]?.values).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: expect.anything() }),
      ])
    );
  });

  it("keeps existing Revision selections immutable during Review updates", async () => {
    await new ReviewMutations().update("review-1", {
      templateRevisionIds: ["revision-b"],
    } as never);

    expect(mocks.draft).not.toHaveBeenCalled();
  });

  it.each([
    [
      "more than three Revisions",
      ["revision-a", "revision-b", "revision-c", "revision-archived"],
    ],
    ["a duplicate Revision", ["revision-a", "revision-a"]],
    ["duplicate parent Templates", ["revision-a", "revision-a-other"]],
    ["a missing Revision", ["revision-missing"]],
    ["a draft Revision", ["revision-draft"]],
    ["a retired Revision", ["revision-retired"]],
    ["a Revision of an archived Template", ["revision-archived"]],
  ])(
    "rejects %s before partial Review rows",
    async (_label, templateRevisionIds) => {
      const writes = installTransaction();
      let error: unknown;

      try {
        await createReview(templateRevisionIds);
      } catch (cause) {
        error = cause;
      }

      expect({ error, writes }).toEqual({
        error: expect.any(Error),
        writes: [],
      });
    }
  );
});
