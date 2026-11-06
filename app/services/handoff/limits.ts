/**
 * Versioned HandoffLimits contract (improvement-plans/REQ-011; AC-039
 * through AC-043).
 *
 * One centrally versioned contract enforced at every TypeScript validation
 * boundary — the domain model and the UI-facing validators share these
 * exact constants and functions, so no limit is ever duplicated. Group 6.6
 * enforces the same contract in Go sync validation, proven against the
 * shared boundary vectors in `tests/fixtures/handoff-limits.v1.json`
 * (version `handoff-limits/v1`).
 *
 * Every text limit counts Unicode code points, never encoded bytes
 * (AC-040): a 2,000-character multi-byte rationale is valid however many
 * bytes it encodes to. Rejection is atomic with field-addressable errors;
 * validators never truncate a value or drop a collection entry.
 *
 * Pure module: no I/O, no Vue, no Nitro, no database.
 */

/** Version identifier shared with the boundary fixture and Go validation. */
export const HANDOFF_LIMITS_VERSION = "handoff-limits/v1" as const;

export const HANDOFF_LIMITS = {
  /** Rationale characters (code points). */
  rationaleChars: 2000,
  /** External and evidence identifier characters each. */
  identifierChars: 128,
  /** HTTPS URL characters. */
  urlChars: 2048,
  /** Helpful links per practice. */
  helpfulLinksPerPractice: 10,
  /** Evidence identifiers per practice. */
  evidenceIdentifiersPerPractice: 20,
  /** Practices per handoff. */
  practicesPerHandoff: 50,
} as const;

export type HandoffLimitViolationCode =
  | "character_limit_exceeded"
  | "collection_limit_exceeded"
  | "invalid_url_scheme";

/** One field-addressable limit violation. */
export interface HandoffLimitViolation {
  /** Field path, e.g. "rationale", "externalId", "helpfulLinks". */
  readonly field: string;
  readonly code: HandoffLimitViolationCode;
  readonly limit: number;
  readonly actual: number;
}

/**
 * Thrown by domain mutations that receive over-limit input. Carries every
 * violation computed by the shared validators, so the UI and the domain
 * report identical field-addressable errors.
 */
export class HandoffLimitError extends Error {
  readonly code = "handoff_limit_exceeded" as const;
  readonly violations: readonly HandoffLimitViolation[];

  constructor(violations: readonly HandoffLimitViolation[]) {
    super(
      `Handoff limit exceeded: ${violations
        .map((v) => `${v.field} (${v.actual}/${v.limit})`)
        .join(", ")}`
    );
    this.name = "HandoffLimitError";
    this.violations = violations;
  }
}

/** Counts Unicode code points — never UTF-16 units or encoded bytes. */
export function characterCount(value: string): number {
  return [...value].length;
}

function textViolation(
  value: string,
  field: string,
  limit: number
): HandoffLimitViolation[] {
  const actual = characterCount(value);
  if (actual <= limit) return [];
  return [{ field, code: "character_limit_exceeded", limit, actual }];
}

/** Validates a rationale against the 2,000-character limit (AC-039). */
export function validateRationale(
  value: string,
  field = "rationale"
): HandoffLimitViolation[] {
  return textViolation(value, field, HANDOFF_LIMITS.rationaleChars);
}

/**
 * Validates an external or evidence identifier against the 128-character
 * limit (AC-039).
 */
export function validateIdentifier(
  value: string,
  field: string
): HandoffLimitViolation[] {
  return textViolation(value, field, HANDOFF_LIMITS.identifierChars);
}

/**
 * Validates an HTTPS URL: https scheme only, at most 2,048 characters
 * (AC-039). Unsafe schemes are rejected regardless of length.
 */
export function validateHttpsUrl(
  value: string,
  field = "url"
): HandoffLimitViolation[] {
  const violations = textViolation(value, field, HANDOFF_LIMITS.urlChars);
  if (!value.startsWith("https://")) {
    violations.push({
      field,
      code: "invalid_url_scheme",
      limit: 0,
      actual: 0,
    });
  }
  return violations;
}

/**
 * Validates the per-practice helpful-links collection: at most 10 entries,
 * each a bounded HTTPS URL (AC-041). Entries are never dropped.
 */
export function validateHelpfulLinks(
  links: readonly { title: string; url: string }[],
  field = "helpfulLinks"
): HandoffLimitViolation[] {
  const violations: HandoffLimitViolation[] = [];
  if (links.length > HANDOFF_LIMITS.helpfulLinksPerPractice) {
    violations.push({
      field,
      code: "collection_limit_exceeded",
      limit: HANDOFF_LIMITS.helpfulLinksPerPractice,
      actual: links.length,
    });
  }
  links.forEach((link, index) => {
    violations.push(...validateHttpsUrl(link.url, `${field}[${index}].url`));
  });
  return violations;
}

/**
 * Validates the per-practice evidence-identifier collection: at most 20
 * entries, each at most 128 characters (AC-041). Entries are never dropped.
 */
export function validateEvidenceIdentifiers(
  identifiers: readonly string[],
  field = "evidenceIdentifiers"
): HandoffLimitViolation[] {
  const violations: HandoffLimitViolation[] = [];
  if (identifiers.length > HANDOFF_LIMITS.evidenceIdentifiersPerPractice) {
    violations.push({
      field,
      code: "collection_limit_exceeded",
      limit: HANDOFF_LIMITS.evidenceIdentifiersPerPractice,
      actual: identifiers.length,
    });
  }
  identifiers.forEach((identifier, index) => {
    violations.push(...validateIdentifier(identifier, `${field}[${index}]`));
  });
  return violations;
}

/** Validates the 50-practice handoff maximum (AC-042). */
export function validatePracticeCount(
  count: number,
  field = "practices"
): HandoffLimitViolation[] {
  if (count <= HANDOFF_LIMITS.practicesPerHandoff) return [];
  return [
    {
      field,
      code: "collection_limit_exceeded",
      limit: HANDOFF_LIMITS.practicesPerHandoff,
      actual: count,
    },
  ];
}

/** Snapshot content subject to the contract (structure validated elsewhere). */
export interface PracticeSnapshotLimitShape {
  readonly helpfulLinks: readonly { title: string; url: string }[];
  readonly evidenceIdentifiers: readonly string[];
}

/**
 * Validates a practice snapshot's bounded collections, reporting every
 * violation in one pass so rejection is atomic (AC-039, AC-041).
 */
export function validatePracticeSnapshot(
  snapshot: PracticeSnapshotLimitShape
): HandoffLimitViolation[] {
  return [
    ...validateHelpfulLinks(snapshot.helpfulLinks),
    ...validateEvidenceIdentifiers(snapshot.evidenceIdentifiers),
  ];
}

/** External reference shape subject to the contract. */
export interface ExternalReferenceLimitShape {
  readonly provider: string;
  readonly externalId: string;
  readonly url: string;
}

/**
 * Validates an external work-item reference: provider and external ID are
 * bounded identifiers; the URL must be HTTPS and bounded (AC-039).
 */
export function validateExternalReference(
  reference: ExternalReferenceLimitShape
): HandoffLimitViolation[] {
  return [
    ...validateIdentifier(reference.provider, "provider"),
    ...validateIdentifier(reference.externalId, "externalId"),
    ...validateHttpsUrl(reference.url, "url"),
  ];
}

/**
 * Throws HandoffLimitError when violations exist; otherwise returns void.
 * The single choke point domain mutations use so rejection stays atomic.
 */
export function assertWithinHandoffLimits(
  violations: readonly HandoffLimitViolation[]
): void {
  if (violations.length > 0) {
    throw new HandoffLimitError(violations);
  }
}

/**
 * Human-readable description of one violation for field-level UI display
 * (improvement-plans/AC-039 through AC-042). Lives beside the contract so
 * the numbers a user sees always come from the shared limits, never from a
 * UI-side copy.
 */
export function describeHandoffViolation(
  violation: HandoffLimitViolation
): string {
  if (violation.code === "invalid_url_scheme") {
    return "Must be an https:// URL.";
  }
  const limit = violation.limit.toLocaleString("en-US");
  const actual = violation.actual.toLocaleString("en-US");
  if (violation.code === "character_limit_exceeded") {
    return `Must be at most ${limit} characters (currently ${actual}).`;
  }
  return `Must contain at most ${limit} entries (currently ${actual}).`;
}
