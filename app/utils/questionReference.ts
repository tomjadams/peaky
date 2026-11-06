/**
 * Derive the short, human-readable question slug (`REL-1`, `OPE-10`) shown in
 * the monospace identifier badges.
 *
 * The slug is never stored: question rows carry opaque storage keys
 * (`{revisionId}:question:01:01`, UUIDs), which are useless to a reader and
 * far too long for a 13px mono chip. The slug is `{PILLAR_PREFIX}-{position}`,
 * derived from the pillar the question sits in plus its 1-based position
 * inside that pillar.
 *
 * Returns `null` when the inputs cannot produce a real slug — callers must
 * omit the badge rather than print the storage key or invent a position.
 */
export function formatQuestionReference(
  pillarSlug: string,
  position: string | number
): string | null {
  const prefix = pillarSlug.trim().slice(0, 3).toUpperCase();
  if (prefix.length === 0) return null;

  const order =
    typeof position === "number" ? position : Number.parseInt(position, 10);
  if (!Number.isFinite(order) || order <= 0) return null;

  return `${prefix}-${order}`;
}
