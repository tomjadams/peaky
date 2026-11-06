import { createTemplateWriteUnavailableError } from "../../utils/templateWriteUnavailable";

export default defineEventHandler(() => {
  throw createTemplateWriteUnavailableError();
});
