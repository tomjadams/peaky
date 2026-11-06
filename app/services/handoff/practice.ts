/**
 * Structured handoff practice reference (improvement-plans/REQ-005; AC-015
 * through AC-018).
 *
 * Practice identity is the tuple
 * `(reviewId, templateRevisionId, questionId, practiceId)`: for checklist
 * questions `practiceId` is the checklist-item ID; for Yes/No questions it
 * equals `questionId` (AC-016). `templateRevisionId` is an opaque string,
 * compared exactly and never parsed (AC-017).
 *
 * Practice-row entity IDs are deterministic from the tuple so concurrent
 * clients converge on one synchronized row instead of creating siblings
 * (design Decision 3).
 *
 * Pure module: no I/O, no Vue, no Nitro, no database.
 */

/** The four components of handoff practice identity. */
export interface PracticeReference {
  readonly reviewId: string;
  /** Opaque TemplateRevision identity — exact match only, never parsed. */
  readonly templateRevisionId: string;
  readonly questionId: string;
  /** Checklist-item ID, or the question ID for Yes/No questions (AC-016). */
  readonly practiceId: string;
}

/**
 * Evidence state is binary (AC-019): exactly met or unmet, derived from the
 * recorded answer. N/A answers are excluded from the handoff projection
 * entirely; no third state such as "needs validation" exists.
 */
export type PracticeEvidenceState = "met" | "unmet";

/**
 * Provenance of a practice's evidence state: the recorded answer it was
 * derived from (AC-018).
 */
export type PracticeEvidenceProvenance =
  | { readonly kind: "yes-no"; readonly answer: "yes" | "no" }
  | { readonly kind: "checklist-item"; readonly checked: boolean };

export interface PracticeEvidence {
  readonly state: PracticeEvidenceState;
  readonly provenance: PracticeEvidenceProvenance;
}

/**
 * Entity-type prefix for deterministic practice-row IDs, matching the
 * `review_handoff_practice` sync entity type (design Decision 3).
 */
const PRACTICE_ENTITY_PREFIX = "review_handoff_practice";

/**
 * Derives the deterministic entity ID for a practice row from its identity
 * tuple. Every component is percent-encoded before joining, so IDs containing
 * separators or near-colliding Revision IDs ("rev-01" vs "rev-1") stay
 * distinct (AC-017). Pure and stable: two clients selecting the same practice
 * derive the same entity ID and converge on one synchronized row.
 */
export function practiceEntityId(reference: PracticeReference): string {
  const segments = [
    reference.reviewId,
    reference.templateRevisionId,
    reference.questionId,
    reference.practiceId,
  ].map((segment) => encodeURIComponent(segment));
  return `${PRACTICE_ENTITY_PREFIX}:${segments.join("/")}`;
}

/**
 * Decodes a deterministic practice entity ID back into its reference tuple.
 * Throws on any ID not produced by `practiceEntityId`.
 */
export function practiceReferenceFromEntityId(
  entityId: string
): PracticeReference {
  const prefix = `${PRACTICE_ENTITY_PREFIX}:`;
  if (!entityId.startsWith(prefix)) {
    throw new Error(`Not a handoff practice entity ID: ${entityId}`);
  }
  const segments = entityId
    .slice(prefix.length)
    .split("/")
    .map((segment) => decodeURIComponent(segment));
  if (segments.length !== 4 || segments.some((segment) => segment === "")) {
    throw new Error(`Malformed handoff practice entity ID: ${entityId}`);
  }
  const [reviewId, templateRevisionId, questionId, practiceId] = segments;
  return {
    reviewId: reviewId!,
    templateRevisionId: templateRevisionId!,
    questionId: questionId!,
    practiceId: practiceId!,
  };
}
