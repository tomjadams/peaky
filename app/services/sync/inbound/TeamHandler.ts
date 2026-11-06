import { createUuidV7, nowISO } from "~/local-db";
import { subjects, teamProfiles } from "#shared/db/schema";
import { and, eq } from "drizzle-orm";
import { localMutation } from "~/services/local-mutation";
import { toFieldMap, toReplayEvent, upsertFieldVersions } from "./helpers";
import type { InboundHandler, PulledEvent } from "./types";

export const TeamHandler: InboundHandler = {
  entityTypes: ["team"],

  async handle(event: PulledEvent): Promise<void> {
    if (event.operation === "delete") {
      await localMutation.replay({
        stateWrite: async (tx) => {
          await tx
            .delete(teamProfiles)
            .where(eq(teamProfiles.subjectId, event.entityId));
          await tx
            .delete(subjects)
            .where(
              and(eq(subjects.id, event.entityId), eq(subjects.type, "team"))
            );
        },
        event: toReplayEvent(event, "TeamDeletedSynced.v1"),
      });
      return;
    }

    const fields = toFieldMap(event.fields);
    const now = nowISO();
    const subjectId = event.entityId;

    await localMutation.replay({
      stateWrite: async (tx) => {
        await tx
          .insert(subjects)
          .values({
            id: subjectId,
            type: "team",
            name: typeof fields.name === "string" ? fields.name : subjectId,
            slug: subjectId,
            status: "active",
            createdAt: now,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: subjects.id,
            set: {
              name: typeof fields.name === "string" ? fields.name : subjectId,
              updatedAt: now,
            },
            where: eq(subjects.type, "team"),
          });

        // Verify the subjects row is actually a team before touching
        // the profile table. The onConflictDoUpdate where clause skips the
        // update if the existing row is a different type, but without this
        // check the profile delete/insert below would contaminate a
        // non-team subject (e.g., a product sharing the same subject ID).
        const subjectRow = await tx
          .select({ type: subjects.type })
          .from(subjects)
          .where(eq(subjects.id, subjectId))
          .limit(1);

        if (!subjectRow.length || subjectRow[0]!.type !== "team") {
          if (import.meta.dev) {
            console.warn(
              `[sync] TeamHandler: subject '${subjectId}' has type '${subjectRow[0]?.type ?? "missing"}'; skipping team profile write`
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
            createdBy: teamProfiles.createdBy,
            createdAt: teamProfiles.createdAt,
          })
          .from(teamProfiles)
          .where(eq(teamProfiles.subjectId, subjectId))
          .limit(1);

        // Replace any existing profile for this team to stay idempotent.
        await tx
          .delete(teamProfiles)
          .where(eq(teamProfiles.subjectId, subjectId));

        await tx.insert(teamProfiles).values({
          id: createUuidV7(),
          subjectId,
          orgId: typeof fields.orgId === "string" ? fields.orgId : "unknown",
          orgName:
            typeof fields.orgName === "string" ? fields.orgName : "Unknown",
          memberCount:
            typeof fields.memberCount === "number" ? fields.memberCount : 0,
          createdBy: existingProfile[0]?.createdBy ?? event.actorId,
          createdAt: existingProfile[0]?.createdAt ?? now,
          updatedAt: now,
        });

        await upsertFieldVersions(tx, event);
      },
      event: toReplayEvent(event, "TeamSynced.v1"),
    });
  },
};
