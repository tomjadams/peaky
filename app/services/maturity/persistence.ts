/**
 * Persistence codec for the versioned maturity definition
 * (maturity-score/REQ-009; AC-009, AC-060).
 *
 * Each TemplateRevision stores at most one definition as a single
 * schema-versioned JSON document in the nullable `maturity_definition` column.
 * NULL is the explicit no-definition state (AC-060) — never an invented
 * default. Decoding accepts the current schema version and rejects unknown
 * versions explicitly so a newer document can never be silently misread by an
 * older client.
 *
 * Pure module: no I/O, no Vue, no Nitro, no database.
 */
import {
  MATURITY_DEFINITION_SCHEMA_VERSION,
  type MaturityDefinition,
} from "./definition";

export class MaturityDefinitionDecodeError extends Error {
  readonly code = "maturity_definition_decode_failed" as const;

  constructor(message: string) {
    super(message);
    this.name = "MaturityDefinitionDecodeError";
  }
}

/** Serializes the definition document exactly as the domain produced it. */
export function serializeMaturityDefinition(
  definition: MaturityDefinition
): string {
  return JSON.stringify(definition);
}

function assertDefinitionShape(document: Record<string, unknown>): void {
  const thresholds = document.thresholds;
  if (
    !Array.isArray(thresholds) ||
    thresholds.length !== 4 ||
    thresholds.some((boundary) => typeof boundary !== "number")
  ) {
    throw new MaturityDefinitionDecodeError(
      "Maturity definition document has malformed thresholds."
    );
  }
  for (const section of ["allocations", "associations", "guidance"] as const) {
    const value = document[section];
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new MaturityDefinitionDecodeError(
        `Maturity definition document has malformed ${section}.`
      );
    }
  }
}

/**
 * Decodes a stored definition document. Returns null for the explicit
 * no-definition state; throws MaturityDefinitionDecodeError for malformed
 * JSON, non-document payloads, and unknown schema versions.
 */
export function decodeMaturityDefinition(
  raw: string | null | undefined
): MaturityDefinition | null {
  if (raw === null || raw === undefined || raw === "") return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new MaturityDefinitionDecodeError(
      "Maturity definition is not valid JSON."
    );
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new MaturityDefinitionDecodeError(
      "Maturity definition is not a document."
    );
  }

  const version = (parsed as Record<string, unknown>).schemaVersion;
  if (version !== MATURITY_DEFINITION_SCHEMA_VERSION) {
    throw new MaturityDefinitionDecodeError(
      `Unsupported maturity definition schema version ${JSON.stringify(version)}; this build understands version ${MATURITY_DEFINITION_SCHEMA_VERSION}.`
    );
  }
  assertDefinitionShape(parsed as Record<string, unknown>);
  return parsed as MaturityDefinition;
}
