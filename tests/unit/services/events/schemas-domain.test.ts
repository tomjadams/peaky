/**
 * Schema payload validation tests — product lifecycle, template lifecycle, and system events.
 * Split from schemas.test.ts to stay within the per-file line limit.
 */
import { describe, it, expect } from "vitest";
import { findCatalogEntryByType } from "~/services/events/schemas/index";

const QUESTION_ID = "q-001";
const TEMPLATE_ID = "t-001";

// ─── Schema validation — product lifecycle ───────────────────

describe("ProductCreated.v1 schema", () => {
  const entry = findCatalogEntryByType("ProductCreated.v1")!;

  const validPayload = {
    name: "Payments Platform",
    teamIds: ["team-a", "team-b"],
    componentIds: ["api-gateway"],
    origin: "bespoke" as const,
    isExternal: false,
    productManagerId: "user-001",
  };

  it("accepts a valid payload", () => {
    expect(entry.schema.safeParse(validPayload).success).toBe(true);
  });

  it("accepts optional fields", () => {
    expect(
      entry.schema.safeParse({
        ...validPayload,
        engineeringLeadId: "user-002",
        roadmapUrl: "https://example.com/roadmap",
        documentationUrl: "https://docs.example.com",
        supportChannel: "#payments-support",
      }).success
    ).toBe(true);
  });

  it("accepts empty arrays", () => {
    expect(
      entry.schema.safeParse({ ...validPayload, teamIds: [], componentIds: [] })
        .success
    ).toBe(true);
  });

  it("rejects missing origin", () => {
    const { origin: _, ...rest } = validPayload;
    expect(entry.schema.safeParse(rest).success).toBe(false);
  });

  it("rejects missing isExternal", () => {
    const { isExternal: _, ...rest } = validPayload;
    expect(entry.schema.safeParse(rest).success).toBe(false);
  });

  it("rejects missing name", () => {
    const { name: _, ...rest } = validPayload;
    expect(entry.schema.safeParse(rest).success).toBe(false);
  });

  it("rejects non-array teamIds", () => {
    expect(
      entry.schema.safeParse({ ...validPayload, teamIds: "team-a" }).success
    ).toBe(false);
  });
});

describe("ProductUpdated.v1 schema", () => {
  const entry = findCatalogEntryByType("ProductUpdated.v1")!;

  it("accepts a changes map", () => {
    expect(
      entry.schema.safeParse({ changes: { name: "New Name", teamIds: [] } })
        .success
    ).toBe(true);
  });

  it("accepts empty changes map", () => {
    expect(entry.schema.safeParse({ changes: {} }).success).toBe(true);
  });

  it("rejects missing changes", () => {
    expect(entry.schema.safeParse({}).success).toBe(false);
  });
});

it.each(["ProductArchived.v1", "ProductRestored.v1"] as const)(
  "%s accepts { previousStatus }",
  (eventType) => {
    const entry = findCatalogEntryByType(eventType)!;
    expect(entry.schema.safeParse({ previousStatus: "active" }).success).toBe(
      true
    );
  }
);

it.each(["ProductArchived.v1", "ProductRestored.v1"] as const)(
  "%s rejects missing previousStatus",
  (eventType) => {
    const entry = findCatalogEntryByType(eventType)!;
    expect(entry.schema.safeParse({}).success).toBe(false);
  }
);

it("ProductDeleted.v1 accepts { name } and rejects missing name", () => {
  const entry = findCatalogEntryByType("ProductDeleted.v1")!;
  expect(entry.schema.safeParse({ name: "Payments Platform" }).success).toBe(
    true
  );
  expect(entry.schema.safeParse({}).success).toBe(false);
});

// ─── Schema validation — template lifecycle ──────────────────

it.each([
  "TemplateDraftCreated.v1",
  "TemplateDraftDeleted.v1",
  "TemplatePublished.v1",
] as const)("%s accepts { name } and rejects missing name", (eventType) => {
  const entry = findCatalogEntryByType(eventType)!;
  expect(entry.schema.safeParse({ name: "Security Review" }).success).toBe(
    true
  );
  expect(entry.schema.safeParse({}).success).toBe(false);
});

it("TemplateDraftUpdated.v1 accepts a changes map and rejects missing changes", () => {
  const entry = findCatalogEntryByType("TemplateDraftUpdated.v1")!;
  expect(entry.schema.safeParse({ changes: { name: "Updated" } }).success).toBe(
    true
  );
  expect(entry.schema.safeParse({}).success).toBe(false);
});

describe("TemplateImported.v1 schema", () => {
  const entry = findCatalogEntryByType("TemplateImported.v1")!;

  it("accepts a valid payload", () => {
    expect(
      entry.schema.safeParse({
        name: "Imported Template",
        pillarCount: 4,
        questionCount: 42,
      }).success
    ).toBe(true);
  });

  it("rejects negative pillarCount", () => {
    expect(
      entry.schema.safeParse({
        name: "x",
        pillarCount: -1,
        questionCount: 0,
      }).success
    ).toBe(false);
  });
});

it.each([
  [
    "TemplatePillarCreated.v1",
    { templateId: TEMPLATE_ID, name: "Reliability" },
  ],
  ["TemplatePillarDeleted.v1", { templateId: TEMPLATE_ID, name: "Old Pillar" }],
  [
    "TemplateQuestionDeleted.v1",
    {
      templateId: TEMPLATE_ID,
      pillarSlug: "reliability",
      questionId: QUESTION_ID,
    },
  ],
] as const)(
  "%s accepts valid payload and rejects empty object",
  (eventType, payload) => {
    const entry = findCatalogEntryByType(eventType)!;
    expect(entry.schema.safeParse(payload).success).toBe(true);
    expect(entry.schema.safeParse({}).success).toBe(false);
  }
);

describe("TemplateQuestionCreated.v1 schema", () => {
  const entry = findCatalogEntryByType("TemplateQuestionCreated.v1")!;

  const validPayload = {
    templateId: TEMPLATE_ID,
    pillarSlug: "reliability",
    questionId: QUESTION_ID,
    questionText: "Do you have on-call runbooks?",
    questionType: "single-select",
    position: 0,
  };

  it("accepts a valid payload", () => {
    expect(entry.schema.safeParse(validPayload).success).toBe(true);
  });

  it("rejects missing questionText", () => {
    const { questionText: _, ...rest } = validPayload;
    expect(entry.schema.safeParse(rest).success).toBe(false);
  });

  it("rejects missing position", () => {
    const { position: _, ...rest } = validPayload;
    expect(entry.schema.safeParse(rest).success).toBe(false);
  });

  it("rejects empty object", () => {
    expect(entry.schema.safeParse({}).success).toBe(false);
  });
});

it("TemplatePillarUpdated.v1 accepts a changes map and rejects missing changes", () => {
  const entry = findCatalogEntryByType("TemplatePillarUpdated.v1")!;
  expect(
    entry.schema.safeParse({
      templateId: TEMPLATE_ID,
      changes: { name: "New" },
    }).success
  ).toBe(true);
  expect(entry.schema.safeParse({}).success).toBe(false);
});

it("TemplateQuestionUpdated.v1 accepts a changes map and rejects missing changes", () => {
  const entry = findCatalogEntryByType("TemplateQuestionUpdated.v1")!;
  expect(
    entry.schema.safeParse({
      templateId: TEMPLATE_ID,
      pillarSlug: "reliability",
      questionId: QUESTION_ID,
      changes: { text: "Updated question" },
    }).success
  ).toBe(true);
  expect(entry.schema.safeParse({}).success).toBe(false);
});

// ─── Schema validation — system events ────────────────────────

describe("LocalDbInitializing.v1 schema", () => {
  const entry = findCatalogEntryByType("LocalDbInitializing.v1")!;

  it("accepts { opfsAvailable }", () => {
    expect(entry.schema.safeParse({ opfsAvailable: true }).success).toBe(true);
  });

  it("rejects missing opfsAvailable", () => {
    expect(entry.schema.safeParse({}).success).toBe(false);
  });
});

describe("LocalDbReady.v1 schema", () => {
  const entry = findCatalogEntryByType("LocalDbReady.v1")!;

  it("accepts a valid payload", () => {
    expect(
      entry.schema.safeParse({ coldStartMs: 230, opfsAvailable: true }).success
    ).toBe(true);
  });

  it("rejects negative coldStartMs", () => {
    expect(
      entry.schema.safeParse({ coldStartMs: -1, opfsAvailable: true }).success
    ).toBe(false);
  });
});

it.each([
  [
    "LocalDbBootstrapStarted.v1",
    { isRecreate: true },
    { isRecreate: "yes" }, // wrong type
  ],
  [
    "LocalDbRecreated.v1",
    { triggeredBy: "user" },
    { triggeredBy: "system" }, // not a permitted literal
  ],
  [
    "LocalDbMigrationFailed.v1",
    {
      migrationId: "0010_events_cloudevents_columns_and_local_status",
      errorMessage: "constraint violation",
    },
    { migrationId: "x" }, // missing errorMessage
  ],
] as const)(
  "%s accepts valid payload, rejects malformed",
  (eventType, valid, invalid) => {
    const entry = findCatalogEntryByType(eventType)!;
    expect(entry.schema.safeParse(valid).success).toBe(true);
    expect(entry.schema.safeParse(invalid).success).toBe(false);
  }
);

describe("OpfsQuotaWarning.v1 schema", () => {
  const entry = findCatalogEntryByType("OpfsQuotaWarning.v1")!;

  const validPayload = {
    usageBytes: 80_000_000,
    quotaBytes: 100_000_000,
    usagePct: 80,
  };

  it("accepts a valid payload", () => {
    expect(entry.schema.safeParse(validPayload).success).toBe(true);
  });

  it("rejects usagePct above 100", () => {
    expect(
      entry.schema.safeParse({ ...validPayload, usagePct: 101 }).success
    ).toBe(false);
  });

  it("rejects negative usageBytes", () => {
    expect(
      entry.schema.safeParse({ ...validPayload, usageBytes: -1 }).success
    ).toBe(false);
  });
});

describe("OpfsStorageMeasured.v1 schema", () => {
  const entry = findCatalogEntryByType("OpfsStorageMeasured.v1")!;

  it("accepts a measured payload with bytes", () => {
    expect(
      entry.schema.safeParse({
        usageBytes: 4_200_000,
        quotaBytes: 100_000_000,
        supported: true,
      }).success
    ).toBe(true);
  });

  it("accepts an unsupported-API payload with null bytes", () => {
    expect(
      entry.schema.safeParse({
        usageBytes: null,
        quotaBytes: null,
        supported: false,
      }).success
    ).toBe(true);
  });

  it("rejects missing supported flag", () => {
    expect(
      entry.schema.safeParse({ usageBytes: null, quotaBytes: null }).success
    ).toBe(false);
  });
});

describe("SyncCycleStarted.v1 schema", () => {
  const entry = findCatalogEntryByType("SyncCycleStarted.v1")!;

  it("accepts a valid payload", () => {
    expect(entry.schema.safeParse({ cycleId: "uuid-001" }).success).toBe(true);
  });

  it("rejects missing cycleId", () => {
    expect(entry.schema.safeParse({}).success).toBe(false);
  });
});

describe("SyncCycleSucceeded.v1 schema", () => {
  const entry = findCatalogEntryByType("SyncCycleSucceeded.v1")!;

  const validPayload = {
    cycleId: "uuid-001",
    eventsPushed: 2,
    eventsPulled: 0,
    durationMs: 412,
  };

  it("accepts a valid payload", () => {
    expect(entry.schema.safeParse(validPayload).success).toBe(true);
  });

  it("rejects negative counts", () => {
    expect(
      entry.schema.safeParse({ ...validPayload, eventsPushed: -1 }).success
    ).toBe(false);
  });
});

describe("SyncCycleFailed.v1 schema", () => {
  const entry = findCatalogEntryByType("SyncCycleFailed.v1")!;

  it("accepts a valid payload", () => {
    expect(
      entry.schema.safeParse({
        cycleId: "uuid-001",
        errorMessage: "network unreachable",
        durationMs: 100,
      }).success
    ).toBe(true);
  });

  it("rejects missing errorMessage", () => {
    expect(
      entry.schema.safeParse({ cycleId: "uuid-001", durationMs: 100 }).success
    ).toBe(false);
  });
});

describe("EntitlementsRefreshed.v1 schema", () => {
  const entry = findCatalogEntryByType("EntitlementsRefreshed.v1")!;

  it("accepts hasDowngrades and changeCount", () => {
    expect(
      entry.schema.safeParse({ hasDowngrades: true, changeCount: 3 }).success
    ).toBe(true);
  });

  it("rejects negative changeCount", () => {
    expect(
      entry.schema.safeParse({ hasDowngrades: false, changeCount: -1 }).success
    ).toBe(false);
  });
});
