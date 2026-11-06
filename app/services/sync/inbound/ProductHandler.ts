import { createUuidV7, nowISO } from "~/local-db";
import { subjects, productProfiles } from "#shared/db/schema";
import type { ProductOrigin } from "#shared/db/schema";
import { and, eq } from "drizzle-orm";
import { localMutation } from "~/services/local-mutation";
import { toFieldMap, toReplayEvent, upsertFieldVersions } from "./helpers";
import type { InboundHandler, PulledEvent } from "./types";

const VALID_ORIGINS = new Set<string>(["bespoke", "open-source", "vendor"]);

export const ProductHandler: InboundHandler = {
  entityTypes: ["product"],

  async handle(event: PulledEvent): Promise<void> {
    if (event.operation === "delete") {
      await localMutation.replay({
        stateWrite: async (tx) => {
          await tx
            .delete(productProfiles)
            .where(eq(productProfiles.subjectId, event.entityId));
          await tx
            .delete(subjects)
            .where(
              and(eq(subjects.id, event.entityId), eq(subjects.type, "product"))
            );
        },
        event: toReplayEvent(event, "ProductDeletedSynced.v1"),
      });
      return;
    }

    const fields = toFieldMap(event.fields);
    const now = nowISO();
    const subjectId = event.entityId;

    const origin: ProductOrigin = VALID_ORIGINS.has(fields.origin as string)
      ? (fields.origin as ProductOrigin)
      : "bespoke";

    await localMutation.replay({
      stateWrite: async (tx) => {
        await tx
          .insert(subjects)
          .values({
            id: subjectId,
            type: "product",
            name: typeof fields.name === "string" ? fields.name : subjectId,
            slug: typeof fields.slug === "string" ? fields.slug : subjectId,
            status:
              (fields.status as "active" | "inactive" | "archived") ?? "active",
            createdAt: now,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: subjects.id,
            set: {
              name: typeof fields.name === "string" ? fields.name : subjectId,
              status:
                (fields.status as "active" | "inactive" | "archived") ??
                "active",
              updatedAt: now,
            },
            where: eq(subjects.type, "product"),
          });

        // Verify the subjects row is actually a product before touching
        // the profile table. The onConflictDoUpdate where clause skips the
        // update if the existing row is a different type, but without this
        // check the profile delete/insert below would contaminate a
        // non-product subject (e.g., a team sharing the same subject ID).
        const subjectRow = await tx
          .select({ type: subjects.type })
          .from(subjects)
          .where(eq(subjects.id, subjectId))
          .limit(1);

        if (!subjectRow.length || subjectRow[0]!.type !== "product") {
          if (import.meta.dev) {
            console.warn(
              `[sync] ProductHandler: subject '${subjectId}' has type '${subjectRow[0]?.type ?? "missing"}'; skipping product profile write`
            );
          }
          await upsertFieldVersions(tx, event);
          return;
        }

        // Preserve immutable authorship metadata from the existing profile
        // before replacing it. The delete+reinsert pattern is idempotent but
        // would otherwise overwrite createdBy/createdAt on every sync.
        const existingProfile = await tx
          .select({
            createdBy: productProfiles.createdBy,
            createdAt: productProfiles.createdAt,
          })
          .from(productProfiles)
          .where(eq(productProfiles.subjectId, subjectId))
          .limit(1);

        // Replace any existing profile for this product to stay idempotent.
        await tx
          .delete(productProfiles)
          .where(eq(productProfiles.subjectId, subjectId));

        await tx.insert(productProfiles).values({
          id: createUuidV7(),
          subjectId,
          origin,
          createdBy: existingProfile[0]?.createdBy ?? event.actorId,
          isExternal:
            typeof fields.isExternal === "boolean"
              ? fields.isExternal
                ? 1
                : 0
              : 0,
          productManagerId:
            typeof fields.productManagerId === "string"
              ? fields.productManagerId
              : event.actorId,
          engineeringLeadId:
            typeof fields.engineeringLeadId === "string"
              ? fields.engineeringLeadId
              : null,
          teamIds:
            typeof fields.teamIds === "string"
              ? fields.teamIds
              : Array.isArray(fields.teamIds)
                ? JSON.stringify(fields.teamIds)
                : "[]",
          componentIds:
            typeof fields.componentIds === "string"
              ? fields.componentIds
              : Array.isArray(fields.componentIds)
                ? JSON.stringify(fields.componentIds)
                : "[]",
          roadmapUrl:
            typeof fields.roadmapUrl === "string" ? fields.roadmapUrl : null,
          documentationUrl:
            typeof fields.documentationUrl === "string"
              ? fields.documentationUrl
              : null,
          supportChannel:
            typeof fields.supportChannel === "string"
              ? fields.supportChannel
              : null,
          createdAt: existingProfile[0]?.createdAt ?? now,
          updatedAt: now,
        });

        await upsertFieldVersions(tx, event);
      },
      event: toReplayEvent(event, "ProductSynced.v1"),
    });
  },
};
