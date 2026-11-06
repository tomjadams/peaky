import {
  getOrganizationById,
  getOrganizationPreferences,
} from "../../../data/organizations";

export default defineEventHandler((event) => {
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

  const preferences = getOrganizationPreferences(orgId);

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
