import { z } from "zod";
import { scopeTypeField, scopeIdField } from "./shared";

// ─── Review answer ────────────────────────────────────────────

export const reviewAnswerRecordedDataSchema = z.object({
  questionId: z
    .string()
    .describe("Unique identifier of the question being answered."),
  answer: z
    .string()
    .nullable()
    .describe("The answer value, or null when the answer is cleared."),
  naReason: z
    .string()
    .nullable()
    .optional()
    .describe("Free-text reason when the question is marked Not Applicable."),
  itemNaReasons: z
    .string()
    .nullable()
    .optional()
    .describe(
      "Serialised per-item N/A reasons for multi-item questions, or null."
    ),
  pillarSlug: z
    .string()
    .optional()
    .describe("URL-safe slug of the pillar this question belongs to."),
  templateId: z
    .string()
    .optional()
    .describe("ID of the template containing this question."),
});
export type ReviewAnswerRecordedData = z.infer<
  typeof reviewAnswerRecordedDataSchema
>;

// ─── Checkpoint ───────────────────────────────────────────────

export const reviewCheckpointSavedDataSchema = z.object({
  templateId: z
    .string()
    .describe(
      "ID of the template whose questions were answered in this batch."
    ),
  note: z
    .string()
    .optional()
    .describe(
      "Optional free-text note summarising the checkpoint session (may contain PII — subject to GDPR erasure)."
    ),
  questionsAnswered: z
    .number()
    .int()
    .min(0)
    .describe("Number of questions that received an answer in this batch."),
  questionsChanged: z
    .number()
    .int()
    .min(0)
    .describe("Number of previously-answered questions whose answer changed."),
  progressDelta: z
    .number()
    .describe(
      "Percentage-point change in overall review progress after this checkpoint."
    ),
  overallProgress: z
    .number()
    .min(0)
    .max(100)
    .describe(
      "Overall review completion percentage (0–100) after this checkpoint."
    ),
  pillarSnapshots: z
    .array(
      z.object({
        slug: z.string().describe("URL-safe slug of the pillar."),
        name: z.string().describe("Display name of the pillar."),
        progress: z
          .number()
          .min(0)
          .max(100)
          .describe("Pillar completion percentage (0–100)."),
        totalQuestions: z
          .number()
          .int()
          .min(0)
          .describe("Total questions in this pillar."),
        answeredQuestions: z
          .number()
          .int()
          .min(0)
          .describe("Questions answered in this pillar."),
      })
    )
    .describe(
      "Per-pillar progress snapshots captured at the time of the checkpoint."
    ),
});
export type ReviewCheckpointSavedData = z.infer<
  typeof reviewCheckpointSavedDataSchema
>;

// ─── Note ─────────────────────────────────────────────────────

export const reviewNoteRecordedDataSchema = z.object({
  scopeType: scopeTypeField,
  scopeId: scopeIdField,
  content: z
    .string()
    .describe(
      "Full note content (free-text, may contain PII — subject to GDPR erasure)."
    ),
});
export type ReviewNoteRecordedData = z.infer<
  typeof reviewNoteRecordedDataSchema
>;

export const reviewNoteDeletedDataSchema = z.object({
  scopeType: scopeTypeField,
  scopeId: scopeIdField,
});
export type ReviewNoteDeletedData = z.infer<typeof reviewNoteDeletedDataSchema>;

// ─── Attachments ──────────────────────────────────────────────

const attachmentBaseSchema = z.object({
  attachmentId: z.string().describe("Unique identifier for the attachment."),
  scopeType: scopeTypeField,
  scopeId: scopeIdField,
  filename: z
    .string()
    .describe("Original filename as supplied by the user at upload time."),
  mimeType: z
    .string()
    .describe("MIME type of the attachment, e.g. 'application/pdf'."),
  fileSize: z
    .number()
    .int()
    .min(0)
    .describe("Size of the attachment in bytes."),
});

export const reviewAttachmentUploadedDataSchema = attachmentBaseSchema;
export type ReviewAttachmentUploadedData = z.infer<
  typeof reviewAttachmentUploadedDataSchema
>;

export const reviewAttachmentDeletedDataSchema = attachmentBaseSchema;
export type ReviewAttachmentDeletedData = z.infer<
  typeof reviewAttachmentDeletedDataSchema
>;

// ─── Progress ─────────────────────────────────────────────────

export const reviewProgressUpdatedDataSchema = z.object({
  pillarSlug: z
    .string()
    .describe(
      "URL-safe slug of the pillar whose progress was recomputed (e.g. 'reliability')."
    ),
  progress: z
    .number()
    .min(0)
    .max(100)
    .describe("Updated completion percentage for this pillar (0–100)."),
});
export type ReviewProgressUpdatedData = z.infer<
  typeof reviewProgressUpdatedDataSchema
>;

// ─── Review lifecycle ─────────────────────────────────────────

export const reviewCreatedDataSchema = z.object({
  name: z.string().describe("Display name of the review."),
  subjectId: z
    .string()
    .describe(
      "ID of the subject being reviewed (product ID or team ID depending on subjectType)."
    ),
  subjectType: z
    .enum(["product", "team"])
    .describe("Whether this review is scoped to a product or a team."),
  templateIds: z
    .array(z.string())
    .describe(
      "Ordered list of template IDs selected for this review at creation time."
    ),
  scope: z
    .enum(["team", "application", "product"])
    .describe(
      "Scope chosen in the review wizard: 'team' for team-level only, 'application' for selected apps, 'product' for the full product."
    ),
  applicationIds: z
    .array(z.string())
    .describe(
      "Application IDs in scope. Empty array when scope is 'team' or 'product'."
    ),
  teamIds: z
    .array(z.string())
    .describe("Team IDs associated with this review at creation time."),
});
export type ReviewCreatedData = z.infer<typeof reviewCreatedDataSchema>;

export const reviewArchivedDataSchema = z.object({
  name: z
    .string()
    .describe("Display name of the review at the time it was archived."),
});
export type ReviewArchivedData = z.infer<typeof reviewArchivedDataSchema>;

export const reviewRestoredDataSchema = z.object({
  name: z.string().describe("Display name of the review that was restored."),
});
export type ReviewRestoredData = z.infer<typeof reviewRestoredDataSchema>;

export const reviewDeletedDataSchema = z.object({
  name: z
    .string()
    .describe(
      "Display name of the review at the time it was permanently deleted."
    ),
});
export type ReviewDeletedData = z.infer<typeof reviewDeletedDataSchema>;
