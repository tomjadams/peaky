import { z } from "zod";
import {
  getOrganizationById,
  setOrganizationPreferences,
} from "../../../data/organizations";

const updateOrganizationPreferencesSchema = z
  .object({
    defaultReviewCadence: z.enum(["monthly", "quarterly"]).optional(),
    notifyAdvisors: z.boolean().optional(),
    preferredTemplateIds: z.array(z.string().trim().min(1)).optional(),
  })
  .refine(
    (input) =>
      input.defaultReviewCadence !== undefined ||
      input.notifyAdvisors !== undefined ||
      input.preferredTemplateIds !== undefined,
    {
      message: "At least one preference field must be provided",
    }
  );

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, "id");

  if (!orgId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Organization ID is required",
    });
  }

  const organization = getOrganizationById(orgId);

  if (!organization) {
    throw createError({
      statusCode: 404,
      statusMessage: "Organization not found",
    });
  }

  const body = await readBody(event);
  const parsed = updateOrganizationPreferencesSchema.safeParse(body);

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage:
        parsed.error.issues[0]?.message ??
        "Invalid organization preferences payload",
    });
  }

  const preferences = setOrganizationPreferences(orgId, parsed.data);

  if (!preferences) {
    throw createError({
      statusCode: 404,
      statusMessage: "Organization preferences not found",
    });
  }

  return {
    orgId,
    preferences,
  };
});
