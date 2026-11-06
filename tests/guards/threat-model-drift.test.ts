/**
 * Drift guard for the STRIDE threat model at
 * site/docs/development/threat-model.md and its narrative companion at
 * site/docs/development/walkthroughs/local-first/security.md.
 *
 * Like spec-drift.test.ts, this is a repository lint expressed with vitest:
 * it reads tracked files from disk and compares them to each other. A threat
 * model rots silently — a renamed file, a raised cap, a new entity type — and
 * nothing fails until someone reads the doc against the code. These assertions
 * are the mechanical link for every fact the doc states that a machine can
 * check: cited paths must exist, and values annotated with a
 * `<!-- drift:<key> -->` marker must equal the constant in the module that
 * owns it.
 *
 * Marker conventions in the doc:
 *   - numeric keys: the last backticked integer before the marker on its line
 *   - set keys: every backticked token after the marker on its line
 *
 * When one of these fails, decide which side is wrong before changing either.
 * If the behavior genuinely changed, update the threat model (and consider
 * whether the change deserves a row in its Known Gaps table); if only a
 * constant moved, update the doc value next to the marker.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const THREAT_MODEL_PATH = "site/docs/development/threat-model.md";
const WALKTHROUGH_PATH =
  "site/docs/development/walkthroughs/local-first/security.md";

function read(relPath: string): string {
  return readFileSync(join(REPO_ROOT, relPath), "utf8");
}

// The canonical threat model and its narrative walkthrough share the drift
// markers between them — each fact lives in exactly one of the two.
const docs = {
  [THREAT_MODEL_PATH]: read(THREAT_MODEL_PATH),
  [WALKTHROUGH_PATH]: read(WALKTHROUGH_PATH),
};
const doc = Object.values(docs).join("\n");

// ── Cited paths ─────────────────────────────────────────────────────────────

const PATH_PATTERN =
  /(?:\.factory|\.agents|app|shared|server|services|tests|formal_verification|explainers)\/[A-Za-z0-9_./-]*[A-Za-z0-9_]/g;

describe("threat model — cited paths", () => {
  const cited = [...new Set(doc.match(PATH_PATTERN) ?? [])].toSorted();

  it("cites at least the core enforcement points", () => {
    for (const path of [
      "services/internal/syncengine/push.go",
      "services/internal/middleware/actor.go",
      "services/internal/authz/registry.go",
      "formal_verification/sync/sse_channel_alignment.fizz",
    ]) {
      expect(cited, `threat model no longer mentions ${path}`).toContain(path);
    }
  });

  it.each(cited)("%s exists", (path) => {
    expect(existsSync(join(REPO_ROOT, path)), `missing: ${path}`).toBe(true);
  });
});

// ── Marker extraction ───────────────────────────────────────────────────────

function markerLine(key: string): string {
  const lines = doc
    .split("\n")
    .filter((candidate) => candidate.includes(`drift:${key}`));
  expect(
    lines,
    `marker drift:${key} must appear on exactly one line across the ` +
      `threat model and the walkthrough`
  ).toHaveLength(1);
  return lines[0]!;
}

/** Numeric keys: the last backticked integer before the marker on its line. */
function docNumber(key: string): number {
  const line = markerLine(key);
  const before = line.slice(0, line.indexOf(`drift:${key}`));
  const integers = [...before.matchAll(/`(\d+)`/g)];
  expect(
    integers.length,
    `no backticked integer before drift:${key}`
  ).toBeGreaterThan(0);
  return Number(integers.at(-1)![1]);
}

/** Set keys: every backticked token after the marker on its line. */
function docSet(key: string): string[] {
  const line = markerLine(key);
  const after = line.slice(line.indexOf(`drift:${key}`));
  return [...after.matchAll(/`([^`]+)`/g)].map((match) => match[1]!);
}

/** Integer value of a Go `const name = 123` declaration. */
function goConstant(source: string, name: string): number {
  const match = new RegExp(`const ${name} = (\\d+)`).exec(source);
  expect(match, `const ${name} not found`).not.toBeNull();
  return Number(match![1]);
}

/** Integer value of a `Name = 123` entry inside a Go `const ( ... )` block. */
function goConstBlockValue(source: string, name: string): number {
  const line = source
    .split("\n")
    .map((candidate) => candidate.trim())
    .find((candidate) => candidate.startsWith(`${name} `));
  expect(line, `const ${name} not found in a const block`).toBeDefined();
  const match = /^\w+\s*=\s*(\d+)/.exec(line!);
  expect(match, `const ${name} has no integer value`).not.toBeNull();
  return Number(match![1]);
}

// ── Sync push caps ──────────────────────────────────────────────────────────

describe("threat model — push caps mirror push.go", () => {
  const push = read("services/internal/syncengine/push.go");

  it("maxPushEvents", () => {
    expect(docNumber("maxPushEvents")).toBe(goConstant(push, "maxPushEvents"));
  });

  it("maxFieldsPerEvent", () => {
    expect(docNumber("maxFieldsPerEvent")).toBe(
      goConstant(push, "maxFieldsPerEvent")
    );
  });
});

// ── Handoff field limits ──────────────────────────────────────────────────

describe("threat model — handoff limits mirror the versioned contract", () => {
  const limits = read("services/internal/syncengine/handoff/limits.go");

  it.each([
    ["handoff-rationale-chars", "RationaleChars"],
    ["handoff-identifier-chars", "IdentifierChars"],
    ["handoff-url-chars", "URLChars"],
    ["handoff-links-per-practice", "HelpfulLinksPerPractice"],
    ["handoff-evidence-per-practice", "EvidenceIdentifiersPerPractice"],
    ["handoff-practices-per-handoff", "PracticesPerHandoff"],
  ])("drift:%s matches the Go %s constant", (key, constant) => {
    expect(docNumber(key)).toBe(goConstBlockValue(limits, constant));
  });
});

// ── Entity registry ─────────────────────────────────────────────────────────

describe("threat model — entity types mirror the sync entity registry", () => {
  const registry = read("services/internal/syncengine/entity/registry.go");

  /** String values of the Type constants named in DefaultRegistry's known list. */
  function registeredTypes(): string[] {
    const constValues = new Map(
      [...registry.matchAll(/(\w+)\s+Type = "([a-z_]+)"/g)].map((match) => [
        match[1]!,
        match[2]!,
      ])
    );
    const known = /known := \[\]Type\{([^}]*)\}/.exec(registry);
    expect(known, "known := []Type{...} block not found").not.toBeNull();
    return known![1]!
      .split(/[,\s]+/)
      .filter(Boolean)
      .map((name) => {
        const value = constValues.get(name);
        expect(
          value,
          `Type constant ${name} has no string value`
        ).toBeDefined();
        return value!;
      });
  }

  it("lists exactly the registered entity types", () => {
    const expected = [
      "product",
      "review",
      "review_answer",
      "review_attachment",
      "review_checkpoint",
      "review_handoff_association",
      "review_handoff_practice",
      "review_maturity_override",
      "review_note",
      "template",
      "template_draft",
      "template_draft_pillar",
      "template_draft_question",
    ];
    expect(markerLine("entity-types")).toContain(
      "extended by the maturity-score change"
    );
    expect(registeredTypes().toSorted()).toEqual(expected.toSorted());
    expect(docSet("entity-types").toSorted()).toEqual(expected.toSorted());
  });

  it("lists exactly the valid operations", () => {
    const ops = [...registry.matchAll(/Op\w* Op = "([a-z]+)"/g)].map(
      (match) => match[1]!
    );
    expect(ops.length, "no Op constants found").toBeGreaterThan(0);
    expect(docSet("operations").toSorted()).toEqual(ops.toSorted());
  });
});

// ── Nuxt runtime limits ─────────────────────────────────────────────────────

describe("threat model — runtime limits mirror nuxt.config.ts", () => {
  const nuxt = read("nuxt.config.ts");

  /** Numeric value of a `key: 1_234` entry, underscores allowed. */
  function nuxtNumber(name: string): number {
    const match = new RegExp(`${name}: ([\\d_]+)`).exec(nuxt);
    expect(match, `${name} not found in nuxt.config.ts`).not.toBeNull();
    return Number(match![1]!.replaceAll("_", ""));
  }

  it("rate limit tokens per interval", () => {
    expect(docNumber("tokensPerInterval")).toBe(
      nuxtNumber("tokensPerInterval")
    );
  });

  it("request body limit (doc states MB)", () => {
    expect(docNumber("maxRequestSizeInBytes") * 1_000_000).toBe(
      nuxtNumber("maxRequestSizeInBytes")
    );
  });

  it("upload limit (doc states MB)", () => {
    expect(docNumber("maxUploadFileRequestInBytes") * 1_000_000).toBe(
      nuxtNumber("maxUploadFileRequestInBytes")
    );
  });

  it("derives the public Template publication value from one private source", () => {
    expect(markerLine("template-publishing-public-config")).toContain(
      "runtimeConfig.public.templatePublishingEnabled"
    );
    expect(nuxt).toMatch(
      /const templatePublishingEnabled = parseTemplatePublishingEnabled\(\s*process\.env\.NUXT_TEMPLATE_PUBLISHING_ENABLED\s*\)/
    );
    expect(nuxt).not.toContain(
      "process.env.NUXT_PUBLIC_TEMPLATE_PUBLISHING_ENABLED"
    );
    expect(nuxt.match(/\btemplatePublishingEnabled,/g)).toHaveLength(2);
    expect(read("shared/config/template-publishing.ts")).toContain(
      'if (value === undefined || value === null || value === "") return false'
    );
    expect(read("server/plugins/template-publishing-config.ts")).toContain(
      "assertTemplatePublishingConfigMatches"
    );
  });
});

describe("threat model — Template write freeze matches implementation", () => {
  it("keeps every mutation-shaped Nitro route on the centralized 503 path", () => {
    expect(markerLine("template-write-freeze")).toContain(
      "template_write_unavailable"
    );
    for (const path of [
      "server/api/templates/index.post.ts",
      "server/api/templates/[id].put.ts",
      "server/api/templates/[id]/publish.post.ts",
      "server/api/templates/[id].delete.ts",
    ]) {
      expect(read(path)).toContain("createTemplateWriteUnavailableError");
    }
    const catalog = read("app/services/template/TemplateCatalog.ts");
    expect(catalog).toContain("TemplateWriteUnavailableError");
    expect(catalog).not.toMatch(/\$fetch.*(?:POST|PUT|DELETE)/s);
    expect(
      read("tests/unit/services/template/TemplateWriteFreeze.test.ts")
    ).toContain("rejects before network or fixture mutation");
  });

  it("keeps unpublished Template authoring on localOnly", () => {
    expect(markerLine("template-drafts-local-only")).toContain("local-only");
    for (const path of [
      "app/composables/local/useLocalTemplateDraft.ts",
      "app/composables/local/useLocalTemplatePillars.ts",
      "app/composables/local/useLocalTemplateQuestions.ts",
      "app/composables/local/useLocalTemplateImport.ts",
    ]) {
      const source = read(path);
      expect(source).toContain("localMutation.localOnly");
      expect(source).not.toMatch(/localMutation\.(?:draft|commit)\(/);
    }
  });
});

describe("threat model — Template Revision boundaries stay explicit", () => {
  it("pins local owner-Team validation without treating it as membership", () => {
    expect(markerLine("template-owner-team-snapshot-only")).toContain(
      "ownerTeamId"
    );
    const source = read("app/composables/local/useLocalTemplateDraft.ts");
    expect(source).toContain("directoryGroups.id");
    expect(source).toContain("input.ownerTeamId");
    expect(read("shared/db/schema/catalog-directory.ts")).not.toContain(
      "memberIds"
    );
  });

  it("pins the bounded destructive Preview reset", () => {
    expect(markerLine("template-review-preview-reset")).toContain(
      "0016_template_revisions.sql"
    );
    for (const path of [
      "shared/db/migrations/sqlite/0016_template_revisions.sql",
      "services/internal/dbmigrate/migrations/008_template_revisions.sql",
    ]) {
      const migration = read(path);
      expect(migration).toContain("DELETE FROM reviews");
      expect(migration).toContain("DELETE FROM templates");
      expect(migration).not.toContain("DELETE FROM products");
    }
    expect(markerLine("template-review-stale-resurrection")).toContain(
      "no sync protocol floor"
    );
  });

  it("pins deferred Review selection transport", () => {
    expect(markerLine("review-selection-transport-deferred")).toContain(
      "local-only"
    );
    expect(
      read("tests/unit/services/entity/ReviewMutations.test.ts")
    ).toContain('expect(fieldNames).toEqual(["subjectId", "name", "status"])');
    expect(read("services/internal/syncengine/handler_test.go")).toContain(
      '"name":  "templateRevisionIds"'
    );
    const boundary = read(
      "tests/unit/tooling/review-selection-sync-boundary.test.ts"
    );
    expect(boundary).toContain("reviewTemplateSelections");
    expect(boundary).toContain("review_template_selections");
  });
});

// ── Ledger counts ───────────────────────────────────────────────────────────

/**
 * The STRIDE summary table in "1. STRIDE at a glance" restates counts that are
 * enumerated as rows further down the page. Those totals used to be maintained
 * by hand in six places, which is how the mitigation ledger drifted from the
 * code in the first place. Here the tables are the source of truth and the
 * summary is checked against them, so adding a row is a one-line edit.
 *
 * Rows are recognised by their leading STRIDE tag cell (`| **T** |`).
 */
const STRIDE_LETTERS = ["S", "T", "R", "I", "D", "E"];

function countByLetter(letters: string[]): Record<string, number> {
  return letters.reduce<Record<string, number>>((acc, letter) => {
    acc[letter] = (acc[letter] ?? 0) + 1;
    return acc;
  }, {});
}

describe("threat model — the STRIDE summary matches the rows it counts", () => {
  const model = docs[THREAT_MODEL_PATH];

  /** Every STRIDE letter tagging a row inside a `##`/`###` section. */
  function tags(heading: RegExp): string[] {
    const section = new RegExp(
      `\\n#{2,3} ${heading.source}\\n(.*?)(?=\\n#{2,3} |$)`,
      "s"
    ).exec(model);
    expect(section, `section ${heading.source} not found`).not.toBeNull();
    return [...section![1]!.matchAll(/^\|\s+\*\*([STRIDE])\*\*\s+\|/gm)].map(
      (match) => match[1]!
    );
  }

  const closed = tags(/4\. Closed by architecture/);
  const tiers = {
    HIGH: tags(/HIGH — \d+/),
    MEDIUM: tags(/MEDIUM — \d+/),
    LOW: tags(/LOW — \d+/),
  };
  const open = [...tiers.HIGH, ...tiers.MEDIUM, ...tiers.LOW];

  /** `| **S** | Spoofing | … | <closed> | <open> |` → the two trailing counts. */
  const summary = new Map(
    [
      ...model.matchAll(
        /^\|\s+\*\*([STRIDE])\*\*\s+\|[^|]*\|[^|]*\|[^|]*\|\s*(\d+)\s*\|\s*(\d+)\s*\|/gm
      ),
    ].map((m) => [m[1]!, { closed: Number(m[2]), open: Number(m[3]) }])
  );

  it("has a summary row per STRIDE letter", () => {
    expect([...summary.keys()].toSorted()).toEqual(STRIDE_LETTERS.toSorted());
  });

  it.each(STRIDE_LETTERS)(
    "%s: summary counts equal the enumerated rows",
    (letter) => {
      expect(summary.get(letter)).toEqual({
        closed: countByLetter(closed)[letter] ?? 0,
        open: countByLetter(open)[letter] ?? 0,
      });
    }
  );

  it("the Total row equals the sum of the ledgers", () => {
    const total =
      /\|\s*\*\*Total\*\*\s*\|[^|]*\|[^|]*\|\s*\*\*(\d+)\*\*\s*\|\s*\*\*(\d+)\*\*\s*\|/.exec(
        model
      );
    expect(total, "Total row not found in the summary table").not.toBeNull();
    expect(Number(total![1])).toBe(closed.length);
    expect(Number(total![2])).toBe(open.length);
  });

  it.each(Object.keys(tiers))(
    "the %s heading states its own row count",
    (tier) => {
      const stated = new RegExp(`### ${tier} — (\\d+)`).exec(model);
      expect(stated, `no count in the ${tier} heading`).not.toBeNull();
      expect(Number(stated![1])).toBe(tiers[tier as keyof typeof tiers].length);
    }
  );

  it("the risk split quoted in the summary prose matches the tiers", () => {
    const prose = /\((\d+) HIGH, (\d+) MEDIUM, (\d+) LOW\)/.exec(model);
    expect(prose, "risk split not quoted in the summary prose").not.toBeNull();
    expect([1, 2, 3].map((i) => Number(prose![i]))).toEqual([
      tiers.HIGH.length,
      tiers.MEDIUM.length,
      tiers.LOW.length,
    ]);
  });
});

// ── Pointers between the security documents ─────────────────────────────────

describe("security documents point at each other", () => {
  it("SECURITY.md links the threat model at its real path", () => {
    expect(read("SECURITY.md")).toContain(THREAT_MODEL_PATH);
  });

  it("the threat model and the walkthrough link each other", () => {
    expect(docs[THREAT_MODEL_PATH]).toContain(
      "walkthroughs/local-first/security"
    );
    expect(docs[WALKTHROUGH_PATH]).toContain("threat-model");
  });

  it("the site nav lists the threat model page", () => {
    expect(read("site/zensical.toml")).toContain("development/threat-model.md");
  });

  it("AGENTS.md points agents at the threat model and this guard", () => {
    const agents = read("AGENTS.md");
    expect(agents).toContain(THREAT_MODEL_PATH);
    expect(agents).toContain("tests/guards/threat-model-drift.test.ts");
  });

  it("the interactive explainer and its source still exist", () => {
    for (const path of [
      "explainers/stride-threat-model-explainer.html",
      "explainers/stride-threat-model-explainer.md",
      "explainers/_sources/stride-threat-model.html",
    ]) {
      expect(existsSync(join(REPO_ROOT, path)), `missing: ${path}`).toBe(true);
    }
  });

  it("both documents name this guard, so the loop is discoverable", () => {
    for (const source of Object.values(docs)) {
      expect(source).toContain("tests/guards/threat-model-drift.test.ts");
    }
  });
});
