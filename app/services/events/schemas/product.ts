import { z } from "zod";
import { changesField } from "./shared";

export const productCreatedDataSchema = z.object({
  name: z.string().describe("Display name of the newly created product."),
  teamIds: z
    .array(z.string())
    .describe("IDs of the teams assigned to this product at creation time."),
  componentIds: z
    .array(z.string())
    .describe(
      "IDs of the application components linked to this product at creation time."
    ),
  origin: z
    .enum(["bespoke", "open-source", "vendor"])
    .describe(
      "How the product was built: 'bespoke' (internally built), 'open-source', or 'vendor' (third-party)."
    ),
  isExternal: z
    .boolean()
    .describe("Whether this product is externally owned or managed."),
  productManagerId: z
    .string()
    .optional()
    .describe("User ID of the assigned product manager."),
  engineeringLeadId: z
    .string()
    .optional()
    .describe("User ID of the assigned engineering lead."),
  roadmapUrl: z.string().optional().describe("URL to the product roadmap."),
  documentationUrl: z
    .string()
    .optional()
    .describe("URL to product documentation."),
  supportChannel: z
    .string()
    .optional()
    .describe("Support channel identifier, e.g. a Slack channel name."),
});
export type ProductCreatedData = z.infer<typeof productCreatedDataSchema>;

export const productUpdatedDataSchema = z.object({
  changes: changesField,
});
export type ProductUpdatedData = z.infer<typeof productUpdatedDataSchema>;

export const productArchivedDataSchema = z.object({
  previousStatus: z
    .string()
    .describe("The product's status value before it was archived."),
});
export type ProductArchivedData = z.infer<typeof productArchivedDataSchema>;

export const productRestoredDataSchema = z.object({
  previousStatus: z
    .string()
    .describe("The product's status value before it was restored."),
});
export type ProductRestoredData = z.infer<typeof productRestoredDataSchema>;

export const productDeletedDataSchema = z.object({
  name: z
    .string()
    .describe(
      "Display name of the product at the time it was permanently deleted."
    ),
});
export type ProductDeletedData = z.infer<typeof productDeletedDataSchema>;
