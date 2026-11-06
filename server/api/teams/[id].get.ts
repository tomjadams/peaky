import { getTeamById } from "../../data/teams";

export default defineEventHandler((event) => {
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: "Team ID is required",
    });
  }

  const team = getTeamById(id);

  if (!team) {
    throw createError({
      statusCode: 404,
      statusMessage: "Team not found",
    });
  }

  return team;
});
