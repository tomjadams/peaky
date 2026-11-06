import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

const root = process.cwd();
const source = (path: string) => readFileSync(resolve(root, path), "utf8");

it("keeps exact Review selections outside inbound domain replay", () => {
  const handler = source("app/services/sync/inbound/ReviewHandler.ts");

  expect(handler).not.toContain("reviewTemplateSelections");
  expect(handler).not.toContain("templateRevisionIds");
});

it("keeps generic PostgreSQL sync persistence outside Review domain tables", () => {
  const repository = source(
    "services/internal/syncengine/repo/postgres.go"
  ).toLowerCase();

  expect(repository).not.toMatch(/insert\s+into\s+reviews\b/);
  expect(repository).not.toContain("review_template_selections");
  expect(repository).toContain("field_versions");
  expect(repository).toContain("field_version_events");
});
