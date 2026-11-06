import {
  TEMPLATE_WRITE_UNAVAILABLE_CODE,
  TEMPLATE_WRITE_UNAVAILABLE_MESSAGE,
} from "../../app/services/template/TemplateRevisionContracts";

export function createTemplateWriteUnavailableError() {
  return createError({
    statusCode: 503,
    statusMessage: TEMPLATE_WRITE_UNAVAILABLE_MESSAGE,
    data: { code: TEMPLATE_WRITE_UNAVAILABLE_CODE },
  });
}
