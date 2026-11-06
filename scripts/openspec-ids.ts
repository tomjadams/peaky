import { existsSync, globSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REQ_ID = /^\*\*ID:\*\*\s*(\S+)\s*$/;
const AC_ID = /^-\s*\*\*ID:\*\*\s*(\S+)\s*$/;
const DIGITS = /^\d+$/;
const DELTA_SECTIONS = new Set(["ADDED", "MODIFIED", "REMOVED"]);

type IdKind = "REQ" | "AC";
export type IdSequence = { req: number; ac: number };
export type IdViolation = { kind: string; detail: string };

type Entry = {
  kind: IdKind;
  section: string;
  key: string;
  label: string;
  ids: string[];
};

type ValidateOptions = {
  capability: string;
  change: string;
  liveSource?: string;
  sequence?: IdSequence;
  allowLegacyIds?: boolean;
};

type ValidationState = {
  options: ValidateOptions;
  sequence: IdSequence;
  violations: IdViolation[];
};

function heading(line: string): { kind: IdKind; label: string } | undefined {
  const trimmed = line.trimStart();
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("### requirement:")) {
    return { kind: "REQ", label: trimmed.slice(16).trim() };
  }
  if (lower.startsWith("#### scenario:")) {
    return { kind: "AC", label: trimmed.slice(14).trim() };
  }
}

function parseEntries(source: string): Entry[] {
  const entries: Entry[] = [];
  let section = "LIVE";
  let requirement = "";
  let current: Entry | undefined;
  let fence: string | undefined;

  for (const line of source.split("\n")) {
    const marker = /^\s*(```|~~~)/.exec(line)?.[1]?.[0];
    if (marker) {
      fence = fence === marker ? undefined : (fence ?? marker);
      continue;
    }
    if (fence) continue;

    const normalized = line.trim().toUpperCase();
    const delta = [...DELTA_SECTIONS, "RENAMED"].find(
      (name) => normalized === `## ${name} REQUIREMENTS`
    );
    if (delta) {
      section = delta;
      requirement = "";
      current = undefined;
      continue;
    }

    const parsed = heading(line);
    if (parsed) {
      if (parsed.kind === "REQ") requirement = parsed.label;
      current = {
        ...parsed,
        section,
        key:
          parsed.kind === "REQ"
            ? parsed.label
            : `${requirement}\0${parsed.label}`,
        ids: [],
      };
      entries.push(current);
      continue;
    }
    if (!current) continue;

    const id = (current.kind === "REQ" ? REQ_ID : AC_ID).exec(line)?.[1];
    if (id) current.ids.push(id);
  }
  return entries;
}

function renamedRequirements(source: string): Map<string, string> {
  const renames = new Map<string, string>();
  let from: string | undefined;
  let active = false;
  let fence: string | undefined;
  for (const line of source.split("\n")) {
    const marker = /^\s*(```|~~~)/.exec(line)?.[1]?.[0];
    if (marker) {
      fence = fence === marker ? undefined : (fence ?? marker);
      continue;
    }
    if (fence) continue;
    const trimmed = line.trim();
    if (trimmed.startsWith("## ")) {
      active = trimmed.toUpperCase() === "## RENAMED REQUIREMENTS";
    }
    if (!active) continue;
    const match = /^- (FROM|TO): `### Requirement: ([^`]+)`$/.exec(trimmed);
    if (match?.[1] === "FROM") from = match[2];
    else if (match?.[1] === "TO" && from && match[2])
      renames.set(match[2], from);
  }
  return renames;
}

function liveKey(entry: Entry, renames: Map<string, string>): string {
  if (entry.kind === "REQ") return renames.get(entry.key) ?? entry.key;
  const [requirement, scenario] = entry.key.split("\0");
  return `${renames.get(requirement!) ?? requirement}\0${scenario}`;
}

function nextId(kind: IdKind, state: ValidationState): string {
  const key = kind === "REQ" ? "req" : "ac";
  const ordinal = String(state.sequence[key]++).padStart(3, "0");
  return `${kind}-${state.options.change}-${ordinal}`;
}

function add(state: ValidationState, kind: string, detail: string): void {
  const { change, capability } = state.options;
  state.violations.push({ kind, detail: `${change}/${capability}: ${detail}` });
}

function validateEntry(
  entry: Entry,
  inherited: string | undefined,
  state: ValidationState
): string | undefined {
  if (entry.ids.length !== 1 || entry.ids[0] === `${entry.kind}-NNN`) {
    const expected = inherited ?? nextId(entry.kind, state);
    const kind = entry.ids.length > 1 ? "multiple-ids" : "missing-id";
    add(state, kind, `${entry.kind} "${entry.label}" needs ${expected}`);
    return;
  }

  const id = entry.ids[0]!;
  if (inherited && id !== inherited) {
    add(
      state,
      "modified-id-mismatch",
      `${entry.kind} "${entry.label}" must retain ${inherited}`
    );
  } else if (!inherited) {
    const legacyPrefix = `${entry.kind}-`;
    if (
      state.options.allowLegacyIds &&
      id.startsWith(legacyPrefix) &&
      DIGITS.test(id.slice(legacyPrefix.length))
    ) {
      return id;
    }
    const prefix = `${entry.kind}-${state.options.change}-`;
    const ordinal = id.slice(prefix.length);
    if (!id.startsWith(prefix)) {
      add(
        state,
        "added-wrong-namespace",
        `${entry.kind} "${entry.label}" must use ${prefix}NNN`
      );
    } else if (ordinal.length < 3 || !DIGITS.test(ordinal)) {
      add(state, "malformed-id", `${entry.kind} "${entry.label}" uses ${id}`);
    }
  }
  return id;
}

export function validateDelta(
  source: string,
  options: ValidateOptions
): { sequence: IdSequence; violations: IdViolation[] } {
  const state: ValidationState = {
    options,
    sequence: { ...(options.sequence ?? { req: 1, ac: 1 }) },
    violations: [],
  };
  const live = new Map(
    parseEntries(options.liveSource ?? "").map((entry) => [entry.key, entry])
  );
  const renames = renamedRequirements(source);
  const seen = new Set<string>();

  for (const entry of parseEntries(source)) {
    if (!DELTA_SECTIONS.has(entry.section)) continue;
    const target = live.get(liveKey(entry, renames));
    const inherited = entry.section === "ADDED" ? undefined : target?.ids[0];
    const id = validateEntry(entry, inherited, state);
    if (id && seen.has(id)) {
      add(state, "duplicate-delta", `delta uses ${id} twice`);
    }
    if (id) seen.add(id);
  }
  return { sequence: state.sequence, violations: state.violations };
}

function directories(root: string): string[] {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .toSorted();
}

function specFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  return globSync("**/spec.md", { cwd: root }).map((path) => join(root, path));
}

function entryIds(source: string): string[] {
  return parseEntries(source).flatMap(({ ids }) => ids);
}

function nextSequence(change: string, sources: string[]): IdSequence {
  const sequence: IdSequence = { req: 1, ac: 1 };
  for (const id of sources.flatMap(entryIds)) {
    for (const [kind, key] of [
      ["REQ", "req"],
      ["AC", "ac"],
    ] as const) {
      const prefix = `${kind}-${change}-`;
      if (!id.startsWith(prefix)) continue;
      const ordinal = Number(id.slice(prefix.length));
      if (Number.isFinite(ordinal)) {
        sequence[key] = Math.max(sequence[key], ordinal + 1);
      }
    }
  }
  return sequence;
}

function duplicateIds(source: string): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const id of entryIds(source)) {
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  }
  return [...duplicates];
}

function claimIds(
  source: string,
  change: string,
  claimed: Set<string>,
  violations: IdViolation[]
): void {
  for (const id of entryIds(source)) {
    if (!id.startsWith(`REQ-${change}-`) && !id.startsWith(`AC-${change}-`)) {
      continue;
    }
    if (claimed.has(id)) {
      violations.push({
        kind: "duplicate-change-id",
        detail: `${change} uses ${id} twice`,
      });
    }
    claimed.add(id);
  }
}

function allowsLegacyIds(changesRoot: string, change: string): boolean {
  const configPath = join(changesRoot, change, ".openspec.yaml");
  if (!existsSync(configPath)) return false;
  const created = /^created:\s*(\d{4}-\d{2}-\d{2})\s*$/m.exec(
    readFileSync(configPath, "utf8")
  )?.[1];
  return created !== undefined && created < "2026-08-27";
}

export function auditIds(root = REPO_ROOT): IdViolation[] {
  const changesRoot = join(root, "openspec", "changes");
  const specsRoot = join(root, "openspec", "specs");
  const archived = directories(join(changesRoot, "archive"));
  const violations: IdViolation[] = [];

  for (const path of specFiles(specsRoot)) {
    for (const id of duplicateIds(readFileSync(path, "utf8"))) {
      violations.push({
        kind: "duplicate-live",
        detail: `${relative(root, path)} uses ${id} more than once`,
      });
    }
  }

  for (const change of directories(changesRoot).filter(
    (name) => name !== "archive"
  )) {
    const reused = archived.find(
      (name) => /^\d{4}-\d{2}-\d{2}-(.+)$/.exec(name)?.[1] === change
    );
    if (reused) {
      violations.push({
        kind: "reused-change-namespace",
        detail: `${change} reuses the namespace from archived change ${reused}`,
      });
    }

    const changeSpecsRoot = join(changesRoot, change, "specs");
    const paths = specFiles(changeSpecsRoot);
    const sources = paths.map((path) => readFileSync(path, "utf8"));
    let sequence = nextSequence(change, sources);
    const claimed = new Set<string>();
    for (const [index, path] of paths.entries()) {
      const capability = relative(changeSpecsRoot, dirname(path))
        .split(sep)
        .join("/");
      const livePath = join(specsRoot, capability, "spec.md");
      const result = validateDelta(sources[index]!, {
        capability,
        change,
        liveSource: existsSync(livePath)
          ? readFileSync(livePath, "utf8")
          : undefined,
        sequence,
        allowLegacyIds: allowsLegacyIds(changesRoot, change),
      });
      sequence = result.sequence;
      violations.push(...result.violations);
      claimIds(sources[index]!, change, claimed, violations);
    }
  }
  return violations;
}

function main(): void {
  const violations = auditIds();
  if (violations.length === 0) {
    console.log("OpenSpec traceability IDs are valid.");
    return;
  }
  for (const violation of violations) console.error(`- ${violation.detail}`);
  process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
