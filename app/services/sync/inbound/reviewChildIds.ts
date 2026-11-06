/**
 * Entity-ID helpers for the typed review children registered in group 6
 * (design Decision 3 of implement-maturity-score): `review_maturity_override`,
 * `review_handoff_practice`, and `review_handoff_association`.
 *
 * The wire format is "<type>:<encodedReviewId>/<...unit segments>" where
 * every segment is percent-encoded so separators can never collide with the
 * structure (the practice encoder lives in app/services/handoff/practice.ts;
 * the Go decoder is entity.RootFor). The owning Review is always the first
 * segment; `templateRevisionId` travels as an opaque segment or field and is
 * never parsed.
 *
 * Pure module: no I/O, no Vue, no Nitro, no database.
 */

/** Percent-encodes one entity-ID path segment (mirrors practice.ts). */
export function encodeEntityIdSegment(segment: string): string {
  return encodeURIComponent(segment);
}

/**
 * Parses a typed review-child entity ID. Returns null for any ID not
 * produced by the matching encoder: wrong prefix, too few segments, or an
 * empty segment. The returned segments are decoded; `unitSegments` are the
 * child unit identity after the owning review.
 */
export function parseTypedReviewChildEntityId(
  entityType: string,
  entityId: string
): { reviewId: string; unitSegments: string[] } | null {
  const prefix = `${entityType}:`;
  if (!entityId.startsWith(prefix)) return null;
  let segments: string[];
  try {
    segments = entityId
      .slice(prefix.length)
      .split("/")
      .map((segment) => decodeURIComponent(segment));
  } catch {
    return null; // malformed percent escape
  }
  if (segments.length < 2 || segments.some((segment) => segment === "")) {
    return null;
  }
  const [reviewId, ...unitSegments] = segments;
  return { reviewId: reviewId!, unitSegments };
}

/** Entity ID for one Advisor override transition of a review. */
export function maturityOverrideEntityId(
  reviewId: string,
  transitionId: string
): string {
  return `review_maturity_override:${encodeEntityIdSegment(reviewId)}/${encodeEntityIdSegment(transitionId)}`;
}

/** Entity ID for one handoff association transition of a review. */
export function handoffAssociationEntityId(
  reviewId: string,
  transitionId: string
): string {
  return `review_handoff_association:${encodeEntityIdSegment(reviewId)}/${encodeEntityIdSegment(transitionId)}`;
}
