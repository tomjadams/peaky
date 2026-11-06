import { getSessionById } from "../../../../data/sessions";

export default defineEventHandler((event) => {
  const sessionId = getRouterParam(event, "sessionId");
  if (!sessionId) {
    throw createError({ statusCode: 400, message: "Session ID is required" });
  }

  const session = getSessionById(sessionId);
  if (!session) {
    throw createError({ statusCode: 404, message: "Session not found" });
  }

  return session;
});
