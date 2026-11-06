import { z } from "zod";
import { recordLifecycleAuditEvent } from "../../data/lifecycle-audit";
import { createProduct } from "../../data/products";
import { getLifecycleActor } from "../../utils/lifecycleActor";

const createProductSchema = z.object({
  name: z.string().trim().min(1).max(120),
  origin: z.enum(["bespoke", "open-source", "vendor"]),
  isExternal: z.boolean().default(false),
  productManagerId: z.string().trim().min(1),
  engineeringLeadId: z.string().trim().min(1).optional(),
  teamIds: z.array(z.string().trim().min(1)).min(1),
  componentIds: z.array(z.string().trim().min(1)).default([]),
  roadmapUrl: z.string().url().optional().or(z.literal("")),
  documentationUrl: z.string().url().optional().or(z.literal("")),
  supportChannel: z.string().trim().optional().or(z.literal("")),
});

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const parsed = createProductSchema.safeParse(body);

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage:
        parsed.error.issues[0]?.message ?? "Invalid product payload",
    });
  }

  const data = parsed.data;
  const product = createProduct({
    name: data.name,
    origin: data.origin,
    isExternal: data.isExternal,
    productManagerId: data.productManagerId,
    engineeringLeadId: data.engineeringLeadId,
    teamIds: data.teamIds,
    componentIds: data.componentIds,
    roadmapUrl: data.roadmapUrl || undefined,
    documentationUrl: data.documentationUrl || undefined,
    supportChannel: data.supportChannel || undefined,
  });

  recordLifecycleAuditEvent({
    action: "create",
    subjectType: "product",
    subjectId: product.id,
    subjectName: product.name,
    actor: await getLifecycleActor(event),
  });

  setResponseStatus(event, 201);
  return product;
});
