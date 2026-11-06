/**
 * Trace byte-equivalence: guidance-only and association-only edits must not
 * change the serialized calculation trace (maturity-score/AC-014, AC-054).
 */
import { describe, expect, it } from "vitest";
import {
  CALCULATION_TRACE_SCHEMA_VERSION,
  calculateMaturity,
  serializeTrace,
} from "~/services/maturity/calculate";
import type { MaturityDefinition } from "~/services/maturity/definition";
import { VECTOR_REVISION_ID } from "./acceptanceVectors";
import { CALCULATION_VECTORS } from "./calculationVectors";

function traceFor(definition: MaturityDefinition, vectorId: string): string {
  const vector = CALCULATION_VECTORS.find((v) => v.id === vectorId)!;
  const answers: Record<
    string,
    NonNullable<(typeof vector.questions)[number]["answer"]>
  > = {};
  for (const question of vector.questions) {
    if (question.answer) answers[question.questionId] = question.answer;
  }
  const calculation = calculateMaturity({
    templateRevisionId: VECTOR_REVISION_ID,
    definition,
    questions: vector.questions,
    answers,
  });
  if (calculation.kind !== "result") throw new Error("expected result");
  return serializeTrace(calculation.trace);
}

describe("calculation trace stability", () => {
  it("versions the exact-point trace shape deterministically", () => {
    const vector = CALCULATION_VECTORS.find(
      (candidate) => candidate.id === "canonical-ten-question-template"
    )!;
    const serialized = traceFor(vector.definition, vector.id);
    const trace = JSON.parse(serialized) as {
      schemaVersion: number;
      available: unknown;
      questions: Array<{ available: unknown }>;
      pillars: Array<{ available: unknown }>;
    };

    expect(CALCULATION_TRACE_SCHEMA_VERSION).toBe(2);
    expect(trace.schemaVersion).toBe(CALCULATION_TRACE_SCHEMA_VERSION);
    expect(trace.available).toEqual({ numerator: "31", denominator: "2" });
    expect(trace.questions[1]?.available).toEqual({
      numerator: "3",
      denominator: "2",
    });
    expect(trace.pillars[0]?.available).toEqual({
      numerator: "17",
      denominator: "2",
    });
    expect(traceFor(vector.definition, vector.id)).toBe(serialized);
  });

  it("guidance-only changes leave the trace byte-equivalent (AC-014)", () => {
    const vector = CALCULATION_VECTORS.find(
      (v) => v.id === "canonical-ten-question-template"
    )!;
    const withGuidance: MaturityDefinition = {
      ...vector.definition,
      guidance: {
        stages: { 1: "Start here", 5: "Sustain" },
        questions: { KQ1: "Why this matters" },
        practices: { KQ2: { P1: "Practice hint" } },
      },
    };
    expect(traceFor(withGuidance, vector.id)).toBe(
      traceFor(vector.definition, vector.id)
    );
  });

  it("association-only changes leave the trace byte-equivalent (AC-054)", () => {
    const vector = CALCULATION_VECTORS.find(
      (v) => v.id === "canonical-ten-question-template"
    )!;
    const moved: MaturityDefinition = {
      ...vector.definition,
      associations: {
        questions: Object.fromEntries(
          Object.keys(vector.definition.associations.questions).map(
            (id, index) => [id, (index % 5) + 1]
          )
        ),
        practices: {},
        stageOrder: { 1: [], 2: [], 3: [], 4: [], 5: [] },
      },
    };
    expect(traceFor(moved, vector.id)).toBe(
      traceFor(vector.definition, vector.id)
    );
  });
});
