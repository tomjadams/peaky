/**
 * Maturity definition validation driven by the shared acceptance vectors
 * (maturity-score/REQ-010, REQ-017).
 */
import { describe, expect, it } from "vitest";
import { validateMaturityDefinition } from "~/services/maturity/definition";
import { DEFINITION_VECTORS } from "./definitionVectors";

describe("validateMaturityDefinition (shared acceptance vectors)", () => {
  for (const vector of DEFINITION_VECTORS) {
    it(`${vector.id} [${vector.cites.join(", ")}]`, () => {
      const issues = validateMaturityDefinition(
        vector.definition,
        vector.questions
      );
      if (vector.expect.ok) {
        expect(issues).toEqual([]);
        return;
      }
      const actual = issues.map((issue) => ({
        code: issue.code,
        path: issue.path,
      }));
      for (const expectedIssue of vector.expect.issues) {
        expect(actual).toContainEqual(expectedIssue);
      }
      // Every issue is field-addressable: a stable path plus a human message.
      for (const issue of issues) {
        expect(issue.path.length).toBeGreaterThan(0);
        expect(issue.message.length).toBeGreaterThan(0);
      }
    });
  }
});
