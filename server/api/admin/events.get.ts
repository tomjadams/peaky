import { listAdminEvents } from "../../data/admin-events";
import { getLifecycleActor } from "../../utils/lifecycleActor";

export default defineEventHandler(async (event) => {
  const actor = await getLifecycleActor(event);

  if (!actor.roles.includes("admin")) {
    throw createError({
      statusCode: 403,
      statusMessage: "Only admins can view audit events",
    });
  }

  return listAdminEvents();
});
