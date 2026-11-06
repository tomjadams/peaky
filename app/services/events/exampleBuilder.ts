/**
 * Utilities for generating example CloudEvents envelopes from JSON Schema payloads.
 *
 * Used by the /schemas/[name] detail page to render a realistic example event.
 * Pure functions — no Vue/reactive dependencies.
 */

/** Well-known field names that map to fixed example values regardless of their JSON Schema type. */
const NAMED_FIELD_EXAMPLES: Record<string, unknown> = {
  name: "Example Name",
  scopeType: "question",
  scopeId: "************************************",
  subjectType: "product",
  subjectId: "************************************",
  templateIds: ["019b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6f"],
  pillarSnapshots: [],
  changes: {},
  content: "Example note content.",
  filename: "example.pdf",
  attachmentId: "************************************",
  publishedAt: "*************:15:00.000Z",
  pillarSlug: "reliability",
  questionId: "************************************",
  templateId: "************************************",
  memberIds: ["019b3c4d-5e6f-7a8b-9c0d-3a4b5c6d7e8f"],
  pillarCount: 3,
  questionCount: 12,
  answer: "yes",
  previousStatus: "active",
  origin: "internal",
};

/** Derive an example value from the field name suffix and JSON Schema type when there is no named override. */
function exampleValueByPattern(key: string, type: string | undefined): unknown {
  if (key.endsWith("Id") && type !== "array")
    return "************************************";
  if (key.endsWith("Ids") && type === "array")
    return ["019b3c4d-5e6f-7a8b-9c0d-4b5c6d7e8f90"];
  if (key.endsWith("Count") && type === "number") return 0;
  if (key.endsWith("At") && type === "string")
    return "*************:15:00.000Z";
  if (key.endsWith("Progress") && type === "number") return 50;
  if (key.endsWith("Delta") && type === "number") return 10;
  if (type === "boolean") return false;
  if (type === "number") return 0;
  if (type === "array") return [];
  return "example";
}

/**
 * Build a realistic example `data` payload from a JSON Schema object.
 * Only required fields are included; values are heuristic-based overrides.
 */
export function buildExampleData(
  schema: Record<string, unknown>
): Record<string, unknown> {
  const props = schema.properties as
    | Record<string, Record<string, unknown>>
    | undefined;
  if (!props) return {};

  const requiredFields = new Set(
    (schema.required as string[] | undefined) ?? []
  );
  const result: Record<string, unknown> = {};

  for (const [key, def] of Object.entries(props)) {
    if (!requiredFields.has(key)) continue;
    const type = def.type as string | undefined;
    result[key] =
      key in NAMED_FIELD_EXAMPLES
        ? NAMED_FIELD_EXAMPLES[key]
        : exampleValueByPattern(key, type);
  }

  return result;
}

/**
 * Map an event type string (e.g. `"ProductCreated.v1"`) to its `entityType` value
 * for use in the CloudEvents envelope example.
 */
export function deriveEntityType(eventType: string): string {
  // Strip version suffix (e.g. ".v1")
  const base = eventType.replace(/\.v\d+$/, "");

  // Known multi-word prefixes ordered longest-first to avoid greedy mismatch
  const prefixes: Array<[string, string]> = [
    ["ReviewAnswerRecorded", "review_answer"],
    ["ReviewCheckpointSaved", "review_checkpoint"],
    ["ReviewNoteRecorded", "review_note"],
    ["ReviewNoteDeleted", "review_note"],
    ["ReviewAttachmentUploaded", "review_attachment"],
    ["ReviewAttachmentDeleted", "review_attachment"],
    ["ReviewProgressUpdated", "review"],
    ["ReviewCreated", "review"],
    ["ReviewArchived", "review"],
    ["ReviewRestored", "review"],
    ["ReviewDeleted", "review"],
    ["ProductCreated", "product"],
    ["ProductUpdated", "product"],
    ["ProductArchived", "product"],
    ["ProductRestored", "product"],
    ["ProductDeleted", "product"],
    ["TemplateDraftCreated", "template_draft"],
    ["TemplateDraftUpdated", "template_draft"],
    ["TemplateDraftDeleted", "template_draft"],
    ["TemplatePillarCreated", "template_pillar"],
    ["TemplatePillarUpdated", "template_pillar"],
    ["TemplatePillarDeleted", "template_pillar"],
    ["TemplateQuestionCreated", "template_question"],
    ["TemplateQuestionUpdated", "template_question"],
    ["TemplateQuestionDeleted", "template_question"],
    ["TemplateImported", "template_draft"],
    ["TemplatePublished", "template_draft"],
    ["ClientSchemaMigrated", "schema"],
  ];

  for (const [prefix, entityType] of prefixes) {
    if (base.startsWith(prefix)) return entityType;
  }

  // Generic fallback: take the first camelCase word, lowercase it
  const match = base.match(/^([A-Z][a-z]+)/);
  return match ? match[1]!.toLowerCase() : "unknown";
}
