/**
 * Shared Zod field builders reused across multiple event schema files.
 *
 * Extract here when the same field definition appears in 3+ schemas.
 */
import { z } from "zod";

/** Scope context — where a note or attachment is attached within a review. */
export const scopeTypeField = z
  .enum(["question", "pillar", "review"])
  .describe(
    "The scope context for this resource (e.g. 'question', 'pillar', 'review')."
  );

/** ID of the scoped resource (question, pillar, or review). */
export const scopeIdField = z
  .string()
  .describe("ID of the scoped resource this item is attached to.");

/** Partial-update changelog — maps field names to their new values. */
export const changesField = z
  .record(z.string(), z.unknown())
  .describe(
    "Map of field names to their new values. Only changed fields are included."
  );

/** ID of the owning template draft. */
export const templateIdField = z
  .string()
  .describe("ID of the template draft this item belongs to.");

/** URL-safe pillar slug. */
export const pillarSlugField = z
  .string()
  .describe("URL-safe slug of the pillar this item belongs to.");
