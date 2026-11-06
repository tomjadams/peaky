import { z } from "zod";
import { changesField, templateIdField, pillarSlugField } from "./shared";

// ─── Draft lifecycle ──────────────────────────────────────────

export const templateDraftCreatedDataSchema = z.object({
  name: z
    .string()
    .describe("Display name of the newly created template draft."),
});
export type TemplateDraftCreatedData = z.infer<
  typeof templateDraftCreatedDataSchema
>;

export const templateDraftUpdatedDataSchema = z.object({
  changes: changesField,
});
export type TemplateDraftUpdatedData = z.infer<
  typeof templateDraftUpdatedDataSchema
>;

export const templateDraftDeletedDataSchema = z.object({
  name: z
    .string()
    .describe(
      "Display name of the template draft at the time it was permanently deleted."
    ),
});
export type TemplateDraftDeletedData = z.infer<
  typeof templateDraftDeletedDataSchema
>;

export const templatePublishedDataSchema = z.object({
  name: z.string().describe("Display name of the published template."),
});
export type TemplatePublishedData = z.infer<typeof templatePublishedDataSchema>;

export const templateImportedDataSchema = z.object({
  name: z.string().describe("Display name given to the imported template."),
  pillarCount: z
    .number()
    .int()
    .min(0)
    .describe("Number of pillars included in the imported template."),
  questionCount: z
    .number()
    .int()
    .min(0)
    .describe(
      "Total number of questions across all pillars in the imported template."
    ),
});
export type TemplateImportedData = z.infer<typeof templateImportedDataSchema>;

// ─── Pillar lifecycle ─────────────────────────────────────────

export const templatePillarCreatedDataSchema = z.object({
  templateId: templateIdField,
  name: z.string().describe("Display name of the newly created pillar."),
});
export type TemplatePillarCreatedData = z.infer<
  typeof templatePillarCreatedDataSchema
>;

export const templatePillarUpdatedDataSchema = z.object({
  templateId: templateIdField,
  changes: changesField,
});
export type TemplatePillarUpdatedData = z.infer<
  typeof templatePillarUpdatedDataSchema
>;

export const templatePillarDeletedDataSchema = z.object({
  templateId: templateIdField,
  name: z
    .string()
    .describe("Display name of the pillar at the time it was deleted."),
});
export type TemplatePillarDeletedData = z.infer<
  typeof templatePillarDeletedDataSchema
>;

// ─── Question lifecycle ───────────────────────────────────────

export const templateQuestionCreatedDataSchema = z.object({
  templateId: templateIdField,
  pillarSlug: pillarSlugField,
  questionId: z.string().describe("Unique identifier of the created question."),
  questionText: z.string().describe("Display text of the created question."),
  questionType: z
    .string()
    .describe(
      "Type identifier for the question, e.g. 'single-select', 'free-text'."
    ),
  position: z
    .number()
    .int()
    .min(0)
    .describe("Zero-based position of the question within the pillar."),
});
export type TemplateQuestionCreatedData = z.infer<
  typeof templateQuestionCreatedDataSchema
>;

export const templateQuestionUpdatedDataSchema = z.object({
  templateId: templateIdField,
  pillarSlug: pillarSlugField,
  questionId: z.string().describe("Unique identifier of the updated question."),
  changes: changesField,
});
export type TemplateQuestionUpdatedData = z.infer<
  typeof templateQuestionUpdatedDataSchema
>;

export const templateQuestionDeletedDataSchema = z.object({
  templateId: templateIdField,
  pillarSlug: pillarSlugField,
  questionId: z.string().describe("Unique identifier of the deleted question."),
});
export type TemplateQuestionDeletedData = z.infer<
  typeof templateQuestionDeletedDataSchema
>;
