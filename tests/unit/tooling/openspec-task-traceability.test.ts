import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

const changeRoot = join(
  process.cwd(),
  "openspec/changes/archive/2026-08-24-migrate-template-revisions"
);
const specsRoot = join(changeRoot, "specs");
const tasks = readFileSync(join(changeRoot, "tasks.md"), "utf8");
const capabilities = readdirSync(specsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .toSorted();

function acceptanceCriteria(capability: string): string[] {
  const source = readFileSync(join(specsRoot, capability, "spec.md"), "utf8");
  return [...source.matchAll(/\*\*ID:\*\* (AC-\d+)/g)].map(
    (match) => match[1]!
  );
}

function taskReferences(): Set<string> {
  const references = new Set<string>();
  for (const parenthetical of tasks.matchAll(/\(([^()]*)\)/g)) {
    for (const segment of parenthetical[1]!.split(";")) {
      const capability = /^\s*([a-z][a-z0-9-]*)\s+/.exec(segment)?.[1];
      if (!capability || !capabilities.includes(capability)) continue;
      for (const match of segment.matchAll(/\bAC-\d+\b/g)) {
        references.add(`${capability}:${match[0]}`);
      }
    }
  }
  return references;
}

it("gives every acceptance criterion a capability-qualified task reference", () => {
  const references = taskReferences();
  const required = capabilities.flatMap((capability) =>
    acceptanceCriteria(capability).map((id) => `${capability}:${id}`)
  );

  expect(required.filter((reference) => !references.has(reference))).toEqual(
    []
  );
});
