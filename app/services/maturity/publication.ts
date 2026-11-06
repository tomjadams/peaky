/**
 * Publication integration for the maturity definition (maturity-score/REQ-009,
 * REQ-010, REQ-017; AC-009 through AC-014, AC-040, AC-041, AC-047, AC-052).
 *
 * One shared draft carries template content and maturity configuration;
 * publication validates and freezes both atomically into one immutable
 * Revision (AC-040). The template write routes stay frozen at HTTP 503
 * `template_write_unavailable` — this module is the domain-level contract
 * those routes will call once the freeze lifts, and the same validator already
 * backs interactive authoring feedback (REQ-010).
 *
 * Atomicity contract: callers gate the Revision write on `ok`. A failed
 * validation carries field-addressable issues only — no serialized payload —
 * so a Revision can never freeze with one part updated and the other missing.
 *
 * Pure module: no I/O, no Vue, no Nitro, no database.
 */
import {
  validateMaturityDefinition,
  type DefinitionIssue,
  type MaturityDefinition,
  type ScorableQuestion,
} from "./definition";
import { buildDefaultMaturityDefinition } from "./defaults";
import { serializeMaturityDefinition } from "./persistence";

export type PublicationMaturityIssue = Pick<DefinitionIssue, "code" | "path">;

export type PublicationMaturity =
  | {
      readonly ok: true;
      /** Serialized document for the Revision column; null = explicit no-definition state (AC-060). */
      readonly maturityDefinition: string | null;
    }
  | { readonly ok: false; readonly issues: readonly DefinitionIssue[] };

export interface PublicationMaturityInput {
  /**
   * The author's maturity configuration for the shared draft:
   * - undefined — the author retained the configured defaults (AC-010);
   * - null — the Revision intentionally publishes without a definition (AC-060);
   * - a document — validated verbatim before freezing.
   */
  readonly definition?: MaturityDefinition | null;
  readonly questions: readonly ScorableQuestion[];
}

/**
 * Validates the maturity configuration of a shared draft and returns the
 * serialized document to freeze with the published Revision, or every issue
 * that blocks publication (invalid ranges, allocation totals, over-length
 * guidance, unassociated questions or practices, more than ten questions).
 */
export function preparePublicationMaturity(
  input: PublicationMaturityInput
): PublicationMaturity {
  if (input.definition === null) {
    return { ok: true, maturityDefinition: null };
  }
  const definition =
    input.definition ?? buildDefaultMaturityDefinition(input.questions);
  const issues = validateMaturityDefinition(definition, input.questions);
  if (issues.length > 0) {
    return { ok: false, issues };
  }
  return {
    ok: true,
    maturityDefinition: serializeMaturityDefinition(definition),
  };
}
