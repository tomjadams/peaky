import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  auditIds,
  validateDelta,
  type IdSequence,
} from "../../scripts/openspec-ids";

const EMPTY_SEQUENCE: IdSequence = { req: 1, ac: 1 };
const temporaryRoots: string[] = [];

const addedDelta = `## ADDED Requirements

### Requirement: Search products

The application SHALL find products by name.
**ID:** REQ-add-product-search-001

#### Scenario: Matching product

- **WHEN** a user searches for a product
- **THEN** the matching product is returned
- **ID:** AC-add-product-search-001
`;

const liveSpec = `## Requirements

### Requirement: Search products

The application SHALL find products by name.
**ID:** REQ-004

#### Scenario: Matching product

- **WHEN** a user searches for a product
- **THEN** the matching product is returned
- **ID:** AC-009
`;

const modifiedDelta = `## MODIFIED Requirements

### Requirement: Search products

The application SHALL find products by name or owner.
**ID:** REQ-004

#### Scenario: Matching product

- **WHEN** a user searches for a product
- **THEN** the matching product is returned
- **ID:** AC-009

#### Scenario: Matching owner

- **WHEN** a user searches for an owner
- **THEN** that owner's products are returned
- **ID:** AC-search-by-owner-001
`;

const renamedDelta = `${modifiedDelta.replace(
  "### Requirement: Search products",
  "### Requirement: Find products"
)}
## RENAMED Requirements

- FROM: \`### Requirement: Search products\`
- TO: \`### Requirement: Find products\`
`;

function repositoryFixture(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "peaky-openspec-ids-"));
  temporaryRoots.push(root);
  for (const [path, source] of Object.entries(files)) {
    const absolute = join(root, path);
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, source);
  }
  return root;
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0))
    rmSync(root, { recursive: true });
});

describe("openspec traceability IDs", () => {
  it("accepts change-scoped IDs", () => {
    expect(
      validateDelta(addedDelta, {
        capability: "products",
        change: "add-product-search",
        sequence: EMPTY_SEQUENCE,
      }).violations
    ).toEqual([]);
  });

  it("reports the exact IDs needed for placeholders", () => {
    const result = validateDelta(
      addedDelta
        .replace("REQ-add-product-search-001", "REQ-NNN")
        .replace("AC-add-product-search-001", "AC-NNN"),
      {
        capability: "products",
        change: "add-product-search",
        sequence: EMPTY_SEQUENCE,
      }
    );

    expect(result.violations.map(({ detail }) => detail)).toEqual([
      'add-product-search/products: REQ "Search products" needs REQ-add-product-search-001',
      'add-product-search/products: AC "Matching product" needs AC-add-product-search-001',
    ]);
  });

  it("preserves existing IDs and scopes new scenarios", () => {
    expect(
      validateDelta(modifiedDelta, {
        capability: "products",
        change: "search-by-owner",
        liveSource: liveSpec,
        sequence: EMPTY_SEQUENCE,
      }).violations
    ).toEqual([]);
  });

  it("preserves IDs when a requirement is renamed and modified", () => {
    expect(
      validateDelta(renamedDelta, {
        capability: "products",
        change: "search-by-owner",
        liveSource: liveSpec,
        sequence: EMPTY_SEQUENCE,
      }).violations
    ).toEqual([]);
  });

  it("rejects concrete IDs from another change", () => {
    const result = validateDelta(
      addedDelta.replace("AC-add-product-search-001", "AC-another-change-001"),
      {
        capability: "products",
        change: "add-product-search",
        sequence: EMPTY_SEQUENCE,
      }
    );

    expect(result.violations.map(({ kind }) => kind)).toContain(
      "added-wrong-namespace"
    );
  });

  it("preserves numeric IDs in active changes created before namespacing", () => {
    const root = repositoryFixture({
      "openspec/changes/legacy-change/.openspec.yaml":
        "schema: peaky-workflow\ncreated: 2026-08-26\n",
      "openspec/changes/legacy-change/specs/products/spec.md": addedDelta
        .replace("REQ-add-product-search-001", "REQ-004")
        .replace("AC-add-product-search-001", "AC-009"),
    });

    expect(auditIds(root)).toEqual([]);
  });

  it("rejects reuse of an archived change namespace", () => {
    const root = repositoryFixture({
      "openspec/changes/add-product-search/specs/products/spec.md": addedDelta,
      "openspec/changes/archive/2026-08-26-add-product-search/.openspec.yaml":
        "schema: peaky-workflow\n",
    });

    expect(auditIds(root).map(({ kind }) => kind)).toContain(
      "reused-change-namespace"
    );
  });

  it("audits the checked-in repository", () => {
    expect(auditIds().map(({ detail }) => detail)).toEqual([]);
  });
});
