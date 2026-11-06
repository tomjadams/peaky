import { describe, it, expect } from "vitest";
import { sanitiseError } from "~/services/events/sanitiseError";

describe("sanitiseError", () => {
  it("strips Error stack frames", () => {
    const error = new Error("constraint violation");
    error.stack =
      "Error: constraint violation\n    at applyMigration (/Users/foo/orr-sample/app/local-db/migrations.ts:103:5)";
    expect(sanitiseError(error)).toBe("constraint violation");
  });

  it("strips absolute paths from messages", () => {
    expect(
      sanitiseError(new Error("Cannot find /Users/foo/orr-sample/secret.json"))
    ).toBe("Cannot find <path>");
  });

  it("strips long colon-tail values (≥60 chars after the colon)", () => {
    // The trailing portion after the colon is 70+ chars and looks like a
    // serialised row. Strip it before any path/email substitution can
    // shorten it under the threshold.
    expect(
      sanitiseError(
        new Error(
          "INSERT INTO events failed: row 1 of 5 with id 01HZX, type ProductCreated, status pending"
        )
      )
    ).toBe("INSERT INTO events failed");
  });

  it("redacts email-shaped tokens before they reach the events table", () => {
    expect(
      sanitiseError(
        new Error(
          "UNIQUE constraint failed: users.email — value: jane@example.com"
        )
      )
    ).toContain("<redacted>");
    expect(sanitiseError(new Error("Email jane@example.com is invalid"))).toBe(
      "Email <redacted> is invalid"
    );
  });

  it("does not over-strip short legitimate colon-tails", () => {
    // 'invalid token at position 12' is ~28 chars — well under the 60-char
    // threshold, so the diagnostic detail survives.
    expect(
      sanitiseError(
        new Error("Could not parse JSON: invalid token at position 12")
      )
    ).toBe("Could not parse JSON: invalid token at position 12");
  });

  it("clips messages above 200 chars", () => {
    const long = "x".repeat(500);
    const out = sanitiseError(new Error(long));
    expect(out.length).toBeLessThanOrEqual(200);
    expect(out.endsWith("…")).toBe(true);
  });

  it("accepts plain strings", () => {
    expect(sanitiseError("network unreachable")).toBe("network unreachable");
  });

  it("returns 'Unknown error' for null/undefined/non-error values", () => {
    expect(sanitiseError(null)).toBe("Unknown error");
    expect(sanitiseError(undefined)).toBe("Unknown error");
    expect(sanitiseError({ unexpected: "object" })).toBe("Unknown error");
  });

  it("returns 'Unknown error' when the message is empty after cleaning", () => {
    expect(sanitiseError(new Error(""))).toBe("Unknown error");
    expect(sanitiseError(new Error("   "))).toBe("Unknown error");
  });
});
