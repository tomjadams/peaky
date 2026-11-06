/**
 * Schema payload validation tests — review operations and lifecycle.
 * Split from schemas.test.ts to stay within the per-file line limit.
 */
import { describe, it, expect } from "vitest";
import { findCatalogEntryByType } from "~/services/events/schemas/index";

const QUESTION_ID = "q-001";
const ATTACHMENT_ID = "att-001";
const TEMPLATE_ID = "t-001";
const SCOPE_PAYLOAD = { scopeType: "question" as const, scopeId: QUESTION_ID };

const REVIEW_LIFECYCLE_EVENTS = [
  "ReviewArchived.v1",
  "ReviewRestored.v1",
  "ReviewDeleted.v1",
] as const;

// ─── Schema validation — review operations ───────────────────

describe("ReviewAnswerRecorded.v1 schema", () => {
  const entry = findCatalogEntryByType("ReviewAnswerRecorded.v1")!;

  it("accepts a valid answer payload", () => {
    const result = entry.schema.safeParse({
      questionId: QUESTION_ID,
      answer: "yes",
    });
    expect(result.success).toBe(true);
  });

  it("accepts null answer (cleared)", () => {
    const result = entry.schema.safeParse({
      questionId: QUESTION_ID,
      answer: null,
    });
    expect(result.success).toBe(true);
  });

  it("accepts optional naReason and itemNaReasons", () => {
    const result = entry.schema.safeParse({
      questionId: QUESTION_ID,
      answer: null,
      naReason: "Not applicable to our stack",
      itemNaReasons: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing questionId", () => {
    const result = entry.schema.safeParse({ answer: "yes" });
    expect(result.success).toBe(false);
  });

  it("rejects non-string questionId", () => {
    const result = entry.schema.safeParse({ questionId: 42, answer: "yes" });
    expect(result.success).toBe(false);
  });

  it("accepts optional pillarSlug and templateId", () => {
    const result = entry.schema.safeParse({
      questionId: QUESTION_ID,
      answer: "yes",
      pillarSlug: "reliability",
      templateId: TEMPLATE_ID,
    });
    expect(result.success).toBe(true);
  });
});

describe("ReviewCheckpointSaved.v1 schema", () => {
  const entry = findCatalogEntryByType("ReviewCheckpointSaved.v1")!;

  const validPayload = {
    templateId: TEMPLATE_ID,
    questionsAnswered: 3,
    questionsChanged: 0,
    progressDelta: 27,
    overallProgress: 27,
    pillarSnapshots: [],
  };

  const pillarSnapshot = {
    slug: "reliability",
    name: "Reliability",
    progress: 50,
    totalQuestions: 10,
    answeredQuestions: 5,
  };

  it("accepts a minimal valid payload", () => {
    expect(entry.schema.safeParse(validPayload).success).toBe(true);
  });

  it("accepts optional note", () => {
    const result = entry.schema.safeParse({
      ...validPayload,
      note: "Completed infrastructure questions",
    });
    expect(result.success).toBe(true);
  });

  it("accepts pillarSnapshots with typed objects", () => {
    expect(
      entry.schema.safeParse({
        ...validPayload,
        pillarSnapshots: [pillarSnapshot],
      }).success
    ).toBe(true);
  });

  it("rejects pillarSnapshot with missing slug", () => {
    const { slug: _, ...snapshotWithoutSlug } = pillarSnapshot;
    expect(
      entry.schema.safeParse({
        ...validPayload,
        pillarSnapshots: [snapshotWithoutSlug],
      }).success
    ).toBe(false);
  });

  it("rejects overallProgress above 100", () => {
    const result = entry.schema.safeParse({
      ...validPayload,
      overallProgress: 101,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing templateId", () => {
    const { templateId: _, ...rest } = validPayload;
    expect(entry.schema.safeParse(rest).success).toBe(false);
  });
});

describe("ReviewNoteRecorded.v1 schema", () => {
  const entry = findCatalogEntryByType("ReviewNoteRecorded.v1")!;

  it("accepts a valid note payload", () => {
    const result = entry.schema.safeParse({
      ...SCOPE_PAYLOAD,
      content: "This looks good.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing content", () => {
    const result = entry.schema.safeParse(SCOPE_PAYLOAD);
    expect(result.success).toBe(false);
  });

  it("rejects invalid scopeType", () => {
    expect(
      entry.schema.safeParse({
        scopeType: "invalid",
        scopeId: QUESTION_ID,
        content: "x",
      }).success
    ).toBe(false);
  });
});

describe("ReviewNoteDeleted.v1 schema", () => {
  const entry = findCatalogEntryByType("ReviewNoteDeleted.v1")!;

  it("accepts a valid payload", () => {
    expect(entry.schema.safeParse(SCOPE_PAYLOAD).success).toBe(true);
  });

  it("rejects missing scopeType", () => {
    expect(entry.schema.safeParse({ scopeId: QUESTION_ID }).success).toBe(
      false
    );
  });
});

const ATTACHMENT_PAYLOAD = {
  attachmentId: ATTACHMENT_ID,
  ...SCOPE_PAYLOAD,
  filename: "architecture.pdf",
  mimeType: "application/pdf",
  fileSize: 204800,
};

it.each(["ReviewAttachmentUploaded.v1", "ReviewAttachmentDeleted.v1"] as const)(
  "%s accepts valid payload",
  (eventType) => {
    expect(
      findCatalogEntryByType(eventType)!.schema.safeParse(ATTACHMENT_PAYLOAD)
        .success
    ).toBe(true);
  }
);

it.each(["ReviewAttachmentUploaded.v1", "ReviewAttachmentDeleted.v1"] as const)(
  "%s rejects missing mimeType",
  (eventType) => {
    const { mimeType: _, ...rest } = ATTACHMENT_PAYLOAD;
    expect(
      findCatalogEntryByType(eventType)!.schema.safeParse(rest).success
    ).toBe(false);
  }
);

it.each(["ReviewAttachmentUploaded.v1", "ReviewAttachmentDeleted.v1"] as const)(
  "%s rejects negative fileSize",
  (eventType) => {
    expect(
      findCatalogEntryByType(eventType)!.schema.safeParse({
        ...ATTACHMENT_PAYLOAD,
        fileSize: -1,
      }).success
    ).toBe(false);
  }
);

it.each(["ReviewAttachmentUploaded.v1", "ReviewAttachmentDeleted.v1"] as const)(
  "%s rejects missing filename",
  (eventType) => {
    const { filename: _, ...rest } = ATTACHMENT_PAYLOAD;
    expect(
      findCatalogEntryByType(eventType)!.schema.safeParse(rest).success
    ).toBe(false);
  }
);

describe("ReviewProgressUpdated.v1 schema", () => {
  const entry = findCatalogEntryByType("ReviewProgressUpdated.v1")!;

  it("accepts a valid payload", () => {
    expect(
      entry.schema.safeParse({ pillarSlug: "reliability", progress: 75 })
        .success
    ).toBe(true);
  });

  it("rejects progress above 100", () => {
    expect(
      entry.schema.safeParse({ pillarSlug: "reliability", progress: 110 })
        .success
    ).toBe(false);
  });

  it("rejects negative progress", () => {
    expect(
      entry.schema.safeParse({ pillarSlug: "reliability", progress: -1 })
        .success
    ).toBe(false);
  });
});

// ─── Schema validation — review lifecycle ────────────────────

describe("ReviewCreated.v1 schema", () => {
  const entry = findCatalogEntryByType("ReviewCreated.v1")!;

  it("accepts a valid product review payload", () => {
    expect(
      entry.schema.safeParse({
        name: "Q4 Readiness Review",
        subjectId: "payments",
        subjectType: "product",
        templateIds: [TEMPLATE_ID],
        scope: "product",
        applicationIds: [],
        teamIds: [],
      }).success
    ).toBe(true);
  });

  it("accepts a team review with targeted application scope", () => {
    expect(
      entry.schema.safeParse({
        name: "Infra Team Review",
        subjectId: "infra-team",
        subjectType: "team",
        templateIds: [],
        scope: "application",
        applicationIds: ["app-001", "app-002"],
        teamIds: ["infra-team"],
      }).success
    ).toBe(true);
  });

  it("rejects invalid subjectType", () => {
    expect(
      entry.schema.safeParse({
        name: "Review",
        subjectId: "x",
        subjectType: "org",
        templateIds: [],
        scope: "team",
        applicationIds: [],
        teamIds: [],
      }).success
    ).toBe(false);
  });

  it("rejects invalid scope", () => {
    expect(
      entry.schema.safeParse({
        name: "Review",
        subjectId: "x",
        subjectType: "team",
        templateIds: [],
        scope: "global",
        applicationIds: [],
        teamIds: [],
      }).success
    ).toBe(false);
  });

  it("rejects missing scope", () => {
    expect(
      entry.schema.safeParse({
        name: "Review",
        subjectId: "x",
        subjectType: "product",
        templateIds: [],
        applicationIds: [],
        teamIds: [],
      }).success
    ).toBe(false);
  });
});

it.each(REVIEW_LIFECYCLE_EVENTS)("%s accepts { name }", (eventType) => {
  const entry = findCatalogEntryByType(eventType)!;
  expect(entry.schema.safeParse({ name: "My Review" }).success).toBe(true);
});

it.each(REVIEW_LIFECYCLE_EVENTS)("%s rejects missing name", (eventType) => {
  const entry = findCatalogEntryByType(eventType)!;
  expect(entry.schema.safeParse({}).success).toBe(false);
});
