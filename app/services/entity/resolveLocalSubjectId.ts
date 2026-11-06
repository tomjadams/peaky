import { eq, or, withDatabase } from "~/local-db";
import { subjects } from "#shared/db/schema";

/**
 * Resolve a subject reference used in routes.
 * Supports canonical subject ids and short public-key slugs.
 */
export async function resolveLocalSubjectId(
  subjectReference: string
): Promise<string | null> {
  if (!subjectReference) {
    return null;
  }

  return withDatabase(async (db) => {
    const rows = await db
      .select({ id: subjects.id })
      .from(subjects)
      .where(
        or(
          eq(subjects.id, subjectReference),
          eq(subjects.slug, subjectReference)
        )
      )
      .limit(1);

    return rows[0]?.id ?? null;
  });
}
