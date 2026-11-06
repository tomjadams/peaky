/**
 * Versioned definition persistence codec (maturity-score/REQ-009; AC-009,
 * AC-040, AC-044, AC-060): one schema-versioned JSON document per immutable
 * TemplateRevision, stored in a single nullable column.
 */
import { describe, expect, it } from "vitest";
import { calculateMaturity } from "~/services/maturity/calculate";
import {
  MATURITY_DEFINITION_SCHEMA_VERSION,
  type MaturityDefinition,
} from "~/services/maturity/definition";
import {
  decodeMaturityDefinition,
  MaturityDefinitionDecodeError,
  serializeMaturityDefinition,
} from "~/services/maturity/persistence";
import { buildDefaultMaturityDefinition } from "~/services/maturity/defaults";
import { VECTOR_REVISION_ID } from "./acceptanceVectors";
import { CALCULATION_VECTORS } from "./calculationVectors";

function vectorDefinition(vectorId: string): MaturityDefinition {
  const vector = CALCULATION_VECTORS.find(
    (candidate) => candidate.id === vectorId
  );
  if (!vector) throw new Error(`missing vector ${vectorId}`);
  return vector.definition;
}

describe("maturity definition persistence codec", () => {
  it("round-trips a definition document byte-for-byte (REQ-009, AC-009)", () => {
    const definition = vectorDefinition("canonical-ten-question-template");
    const stored = serializeMaturityDefinition(definition);
    const decoded = decodeMaturityDefinition(stored);

    expect(decoded).toEqual(definition);
    expect(decoded && serializeMaturityDefinition(decoded)).toBe(stored);
  });

  it("decodes a NULL column as the explicit no-definition state (AC-060)", () => {
    expect(decodeMaturityDefinition(null)).toBeNull();
    expect(decodeMaturityDefinition(undefined)).toBeNull();
  });

  it("accepts the current schema version (forward-compatible decoding)", () => {
    const definition = vectorDefinition("severity-weights");
    const stored = serializeMaturityDefinition(definition);
    expect(JSON.parse(stored).schemaVersion).toBe(
      MATURITY_DEFINITION_SCHEMA_VERSION
    );
    expect(decodeMaturityDefinition(stored)).toEqual(definition);
  });

  it("rejects unknown schema versions explicitly", () => {
    const definition = vectorDefinition("severity-weights");
    for (const unknownVersion of [0, 2, 99, "1"]) {
      const stored = JSON.stringify({
        ...definition,
        schemaVersion: unknownVersion,
      });
      expect(() => decodeMaturityDefinition(stored)).toThrow(
        MaturityDefinitionDecodeError
      );
      expect(() => decodeMaturityDefinition(stored)).toThrow(/schema version/i);
    }
  });

  it("rejects malformed JSON and non-document payloads explicitly", () => {
    for (const raw of ["{not json", "42", '"text"', "[]", "null"]) {
      expect(() => decodeMaturityDefinition(raw)).toThrow(
        MaturityDefinitionDecodeError
      );
    }
  });

  it("a retired Revision keeps calculating from its pinned definition (AC-044)", () => {
    // Persisted documents carry no status semantics: a definition stored on a
    // Revision that later transitions published → retired must decode and
    // calculate identically.
    const definition = vectorDefinition("yes-no-contributes");
    const storedOnPublished = serializeMaturityDefinition(definition);
    const storedOnRetired = storedOnPublished;

    const decoded = decodeMaturityDefinition(storedOnRetired);
    expect(decoded).toEqual(definition);

    const vector = CALCULATION_VECTORS.find(
      (candidate) => candidate.id === "yes-no-contributes"
    )!;
    const answers: Record<string, "yes" | "no"> = {};
    for (const question of vector.questions) {
      if (question.answer === "yes" || question.answer === "no") {
        answers[question.questionId] = question.answer;
      }
    }
    const calculation = calculateMaturity({
      templateRevisionId: VECTOR_REVISION_ID,
      definition: decoded!,
      questions: vector.questions,
      answers,
    });
    expect(calculation.kind).toBe("result");
  });

  it("pinned reviews read the stored document, never mutable draft state (AC-009)", () => {
    const questions = vectorQuestions("yes-no-contributes");
    const pinned = buildDefaultMaturityDefinition(questions);
    const stored = serializeMaturityDefinition(pinned);

    // Simulate later authoring: the mutable draft moves on after pinning.
    const evolvedDraft: MaturityDefinition = {
      ...pinned,
      thresholds: [30, 50, 70, 90],
    };
    expect(serializeMaturityDefinition(evolvedDraft)).not.toBe(stored);

    // The pinned read path decodes the stored document only.
    expect(decodeMaturityDefinition(stored)).toEqual(pinned);
  });
});

function vectorQuestions(vectorId: string) {
  const vector = CALCULATION_VECTORS.find(
    (candidate) => candidate.id === vectorId
  );
  if (!vector) throw new Error(`missing vector ${vectorId}`);
  return vector.questions;
}
