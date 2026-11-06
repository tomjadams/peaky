/**
 * E2E seed helpers — create test data using the app's own mutation functions.
 *
 * ## How local-first seeding works
 *
 * This app is **local-first**: the browser owns a SQLite database (OPFS via
 * SQLocal) that is the source of truth for templates, products, reviews, and
 * all assessment data.  There is no server API for creating these resources —
 * all writes go through client-side mutation functions that validate input,
 * insert via Drizzle ORM, emit domain events, and queue outbox entries for
 * eventual sync.
 *
 * Playwright tests run in Node.js, so they cannot call these mutation functions
 * directly.  Instead, a dev-only Nuxt plugin (`app/plugins/test-seed.client.ts`)
 * exposes the mutation functions on `window.__peakySeed`.  The seed helpers in
 * this file call them through `page.evaluate()`.
 *
 * ### Why mutation functions instead of raw SQL?
 *
 * - **Migration-proof**: Raw SQL breaks silently when a migration renames a
 *   column. Drizzle-backed mutations fail at compile time.
 * - **Realistic state**: Seeded data includes domain events and outbox entries,
 *   just like production writes.
 * - **Single source of truth**: The same code path that the UI uses.
 *
 * ### Side effects (and why they're fine)
 *
 * Mutation functions emit domain events and create outbox entries.  In E2E tests
 * there is no real sync engine pushing to a server, so outbox entries are inert.
 * The domain events represent correct audit state — a feature, not a bug.
 *
 * ### What about teams?
 *
 * Teams are server-catalog data (read-only in production).  There is no
 * `TeamMutations.create()`.  For E2E seeding we insert via Drizzle ORM directly
 * — still schema-aware, so a migration will surface as a compile error.
 *
 * ## Quick start
 *
 *   // In a Playwright test using the custom fixture:
 *   import { test, expect } from "./helpers/fixtures";
 *
 *   test("example", async ({ page, seed }) => {
 *     // seed.template, seed.team, seed.product, seed.review are ready
 *     await page.goto(`/teams/${seed.team.id}`);
 *   });
 *
 * @see app/plugins/test-seed.client.ts       — Dev-only plugin exposing mutations
 * @see app/services/entity/                  — Mutation classes (the real write layer)
 * @see app/composables/local/                — Template draft CRUD (pillars, questions)
 * @see tests/e2e/helpers/fixtures.ts         — Playwright fixture wiring
 * @see tests/e2e/fixtures/seed-template.md   — Markdown fixture for import/export tests
 */

import type { Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SeedTemplate {
  id: string;
  publishedRevisionId: string;
  selectionRevisionId: string;
  selectionName: string;
  name: string;
  description: string;
}

export interface SeedPillar {
  id: string;
  slug: string;
  name: string;
}

export interface SeedQuestion {
  id: string;
  text: string;
  type: "yes-no" | "checklist";
  pillarSlug: string;
}

export interface SeedTeam {
  id: string;
  name: string;
}

export interface SeedProduct {
  id: string;
  name: string;
}

export interface SeedReview {
  id: string;
  name: string;
  subjectId: string;
  templateId: string;
}

export interface SeedResult {
  template: SeedTemplate;
  pillars: {
    reliability: SeedPillar;
    security: SeedPillar;
  };
  questions: {
    yesNo1: SeedQuestion;
    yesNo2: SeedQuestion;
    checklist1: SeedQuestion;
    checklist2: SeedQuestion;
  };
  team: SeedTeam;
  product: SeedProduct;
  review: SeedReview;
}

// ---------------------------------------------------------------------------
// Seed template definition
//
// Plain data that mirrors what `tests/e2e/fixtures/seed-template.md` describes.
// The .md file is the human-readable documentation; this is what the seed
// actually uses to drive mutation calls via window.__peakySeed.
// ---------------------------------------------------------------------------

const SELECTION_REVISION_ID = "01932b3c-7d00-7000-8100-000000001001";
const SELECTION_REVISION_NAME = "Operational Readiness Review (ORR)";

const SEED_TEMPLATE = {
  name: "[E2E] Operational Readiness Review",
  description:
    "A lightweight readiness review template used by E2E tests. Covers reliability and security pillars with a mix of yes/no and checklist questions.",
  pillars: [
    {
      name: "Reliability",
      slug: "reliability",
      questions: [
        {
          text: "Have you performed a full failover test in the last 30 days?",
          type: "yes-no" as const,
          riskLevel: "critical",
          importance:
            "Failover testing validates disaster recovery procedures.",
        },
        {
          text: "Is your service capable of handling 2x normal peak traffic?",
          type: "yes-no" as const,
          riskLevel: "high",
          importance: "Capacity planning prevents outages during peak load.",
        },
      ],
    },
    {
      name: "Security",
      slug: "security",
      questions: [
        {
          text: "Which security review practices are in place?",
          type: "checklist" as const,
          riskLevel: "critical",
          importance:
            "Security reviews catch vulnerabilities before production.",
        },
        {
          text: "Which monitoring practices are currently active?",
          type: "checklist" as const,
          riskLevel: "high",
          importance: "Monitoring ensures rapid detection of incidents.",
        },
      ],
    },
  ],
} as const;

// ---------------------------------------------------------------------------
// Browser bridge
// ---------------------------------------------------------------------------

/**
 * Wait for `window.peakyDB` to report the local database as open and ready.
 *
 * The database is bootstrapped asynchronously by the local-db plugin on first
 * page load.  We must wait for it before calling any mutation function.
 */
export async function waitForLocalDb(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const w = window as unknown as {
        peakyDB?: { isOpen: () => boolean };
        __peakySeed?: object;
      };
      return (
        w.peakyDB?.isOpen?.() === true && typeof w.__peakySeed === "object"
      );
    },
    { timeout: 15_000 }
  );
}

// ---------------------------------------------------------------------------
// Individual seed functions
//
// Each function calls a mutation via `window.__peakySeed` (exposed by the
// dev-only plugin).  The mutations run the same code path the app uses:
// Drizzle insert → domain event → outbox entry.
// ---------------------------------------------------------------------------

export async function grantTemplateEdit(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await (window as any).__peakySeed.grantTemplateEdit();
  });
}

export async function ensureDirectoryGroups(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const groups = await (window as any).__peakySeed.ensureDirectoryGroups();
    if (!Array.isArray(groups) || !groups[0]?.id) {
      throw new Error("Directory-group snapshot is empty");
    }
    return String(groups[0].id);
  });
}

/** Create a template draft and return its ID. */
export async function seedTemplate(
  page: Page,
  input: {
    name: string;
    description?: string;
    ownerTeamId?: string;
    actorId?: string;
  }
): Promise<string> {
  const ownerTeamId = input.ownerTeamId ?? (await ensureDirectoryGroups(page));
  return page.evaluate(
    async (args) => {
      const seed = (window as any).__peakySeed;
      return seed.createTemplateDraft({
        name: args.input.name,
        description: args.input.description,
        ownerTeamId: args.ownerTeamId,
        actorId: args.input.actorId ?? "user-001",
      });
    },
    { input, ownerTeamId }
  );
}

/** Add a pillar to a template draft and return the pillar ID. */
export async function seedPillar(
  page: Page,
  input: { draftId: string; name: string; slug: string; description?: string }
): Promise<string> {
  return page.evaluate(async (args) => {
    const seed = (window as any).__peakySeed;
    return seed.addPillar(args.draftId, args.name, args.slug, args.description);
  }, input);
}

/** Add a question to a pillar and return the question ID. */
export async function seedQuestion(
  page: Page,
  input: {
    draftId: string;
    pillarId: string;
    text: string;
    type?: "yes-no" | "checklist";
    riskLevel?: string;
    importance?: string;
  }
): Promise<string> {
  return page.evaluate(async (args) => {
    const seed = (window as any).__peakySeed;
    return seed.addQuestion(args.draftId, args.pillarId, {
      text: args.text,
      type: args.type ?? "yes-no",
      riskLevel: args.riskLevel ?? "medium",
      importance: args.importance ?? "",
    });
  }, input);
}

export async function seedPublishedRevisionSnapshot(
  page: Page,
  draftId: string
): Promise<string> {
  return page.evaluate(async (revisionId) => {
    const seed = (window as any).__peakySeed;
    return seed.freezeTemplateFixture(revisionId);
  }, draftId);
}

/**
 * Create a team in the local database.
 *
 * Teams are server-catalog data in production (read-only on the client).
 * For E2E tests we insert via Drizzle — see `app/plugins/test-seed.client.ts`.
 */
export async function seedTeam(
  page: Page,
  input: { name: string; orgId?: string; orgName?: string }
): Promise<string> {
  return page.evaluate(async (args) => {
    const seed = (window as any).__peakySeed;
    return seed.createTeam(args);
  }, input);
}

/**
 * Create a product via the ProductMutations service.
 *
 * Goes through the full mutation path: subjects + product_profiles +
 * ProductCreated domain event + outbox entry.
 */
export async function seedProduct(
  page: Page,
  input: { name: string; teamIds: string[] }
): Promise<string> {
  return page.evaluate(async (args) => {
    const seed = (window as any).__peakySeed;
    return seed.createProduct({
      name: args.name,
      origin: "bespoke",
      isExternal: false,
      productManagerId: "e2e-user",
      teamIds: args.teamIds,
      componentIds: [],
      createdBy: "e2e-seed",
    });
  }, input);
}

/**
 * Create a review via the ReviewMutations service.
 *
 * Goes through the full mutation path: reviews + review_template_selections +
 * ReviewCreated domain event + outbox entry.
 */
export async function seedReview(
  page: Page,
  input: {
    name: string;
    subjectId: string;
    subjectType: "product" | "team";
    templateRevisionIds: string[];
  }
): Promise<string> {
  return page.evaluate(async (args) => {
    const seed = (window as any).__peakySeed;
    return seed.createReview({
      subjectId: args.subjectId,
      subjectType: args.subjectType,
      name: args.name,
      templateRevisionIds: args.templateRevisionIds,
      scope: args.subjectType,
    });
  }, input);
}

/** Save a review answer through the same local-first mutation used by the UI. */
export async function saveAnswer(
  page: Page,
  input: {
    reviewId: string;
    questionId: string;
    answer:
      | "yes"
      | "no"
      | "na"
      | string[]
      | { checked: string[]; na: string[] };
    pillarSlug?: string;
    templateId?: string;
  }
): Promise<void> {
  await page.evaluate(async (args) => {
    const seed = (window as any).__peakySeed;
    return seed.saveAnswer(args);
  }, input);
}

// ---------------------------------------------------------------------------
// Standard scenario
//
// Seeds everything a typical test suite needs:
//   - 1 template (published/active, 2 pillars, 4 questions)
//   - 1 team
//   - 1 product (owned by the team)
//   - 1 review (on the team, using the template)
//
// Call after `page.goto("/")` + `waitForLocalDb(page)`.
// After seeding, call `page.reload()` so the UI picks up the new data.
// ---------------------------------------------------------------------------

async function seedScenarioTemplate(
  page: Page,
  name: string,
  ownerTeamId: string
) {
  const templateId = await seedTemplate(page, {
    name,
    description: SEED_TEMPLATE.description,
    ownerTeamId,
  });
  const pillarIds: Record<string, string> = {};
  const questions: SeedQuestion[] = [];

  for (const pillar of SEED_TEMPLATE.pillars) {
    const pillarId = await seedPillar(page, {
      draftId: templateId,
      name: pillar.name,
      slug: pillar.slug,
    });
    pillarIds[pillar.slug] = pillarId;

    for (const question of pillar.questions) {
      const id = await seedQuestion(page, {
        draftId: templateId,
        pillarId,
        text: question.text,
        type: question.type,
        riskLevel: question.riskLevel,
        importance: question.importance,
      });
      questions.push({
        id,
        text: question.text,
        type: question.type,
        pillarSlug: pillar.slug,
      });
    }
  }

  return { templateId, pillarIds, questions };
}

export async function seedStandardScenario(
  page: Page,
  _options?: { prefix?: string }
): Promise<SeedResult> {
  const ts = Date.now();

  const templateName = `${SEED_TEMPLATE.name} ${ts}`;
  const teamName = `[E2E] Test Team ${ts}`;
  const productName = `[E2E] Test Product ${ts}`;
  const reviewName = `[E2E] Test Review ${ts}`;

  const ownerTeamId = await ensureDirectoryGroups(page);
  await grantTemplateEdit(page);

  // Keep the Studio fixture editable and freeze a separate copy for Reviews.
  const editableTemplate = await seedScenarioTemplate(
    page,
    templateName,
    ownerTeamId
  );
  const reviewTemplate = await seedScenarioTemplate(
    page,
    `[E2E] Review Snapshot ${ts}`,
    ownerTeamId
  );
  const publishedRevisionId = await seedPublishedRevisionSnapshot(
    page,
    reviewTemplate.templateId
  );
  const { templateId, pillarIds, questions: allQuestions } = editableTemplate;

  // ── Team and product ─────────────────────────────────────────────────
  const teamId = await seedTeam(page, { name: teamName });
  const productId = await seedProduct(page, {
    name: productName,
    teamIds: [teamId],
  });

  // ── Review (linked to team, using the template) ──────────────────────
  const reviewId = await seedReview(page, {
    name: reviewName,
    subjectId: teamId,
    subjectType: "team",
    templateRevisionIds: [publishedRevisionId],
  });

  return {
    template: {
      id: templateId,
      publishedRevisionId,
      selectionRevisionId: SELECTION_REVISION_ID,
      selectionName: SELECTION_REVISION_NAME,
      name: templateName,
      description: SEED_TEMPLATE.description,
    },
    pillars: {
      reliability: {
        id: pillarIds["reliability"]!,
        slug: "reliability",
        name: "Reliability",
      },
      security: {
        id: pillarIds["security"]!,
        slug: "security",
        name: "Security",
      },
    },
    questions: {
      yesNo1: allQuestions[0]!,
      yesNo2: allQuestions[1]!,
      checklist1: allQuestions[2]!,
      checklist2: allQuestions[3]!,
    },
    team: { id: teamId, name: teamName },
    product: { id: productId, name: productName },
    review: {
      id: reviewId,
      name: reviewName,
      subjectId: teamId,
      templateId: publishedRevisionId,
    },
  };
}
