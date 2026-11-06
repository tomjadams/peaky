/**
 * Scoped-pull e2e — entitlement-scoped sync visibility across personas.
 *
 * Gated on `PEAKY_E2E_SYNC_STACK=1` (i.e. `make watch` running the Go API +
 * SSE + PostgreSQL). One browser context per persona; each persona boots the
 * app with its own `peaky:current-actor`, so the server-side authz registry
 * resolves that persona's entitlements during pull.
 *
 * What this proves end-to-end (the 5A integration tests cover the SQL
 * predicate in isolation; this covers the real browser → local DB → push →
 * server → pull → local DB loop):
 *
 *   #53  a wildcard in one family (product:*) must not leak another family's
 *        scoped data (review-999) into the pull.
 *   #83  a scoped actor (review:review-001) pulls only its entitled root's
 *        children, never a sibling root's.
 *   I3   a single-family wildcard (review:*) seals — no product events leak.
 *
 * Review answers are driven through `saveAnswer` with a controlled `reviewId`
 * so the entity_id is deterministic (`review-001:q-…`). Products go through
 * `createProduct` (UUID); the wildcard personas see them, the scoped persona
 * does not.
 *
 * NOTE: ProductMutations.create() pushes outbox entries with empty fields
 * (fields: JSON.stringify([])), so the product name is NOT included in the
 * synced event. The ProductHandler falls back to the entity UUID for the
 * subjects.name column. We search by UUID (returned by seedProduct) instead
 * of name. This is a pre-existing gap, not a pull-scoping regression.
 *
 * @see tests/e2e/helpers/personas.ts — reusable persona helper (Cedar-forward)
 * @see tests/e2e/helpers/seed.ts     — saveAnswer, seedProduct (writer side)
 */

import { test, type Browser } from "@playwright/test";
import {
  personaPage,
  syncNow,
  expectSees,
  expectDoesNotSee,
  PERSONAS,
  type Persona,
  type PersonaHandle,
} from "./helpers/personas";
import { saveAnswer, seedProduct } from "./helpers/seed";

const SYNC_STACK = process.env.PEAKY_E2E_SYNC_STACK === "1";

test.describe("Scoped pull e2e (requires Go sync stack)", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(
    !SYNC_STACK,
    "Set PEAKY_E2E_SYNC_STACK=1 with the stack up — or run `make test:e2e:sync`"
  );

  // Shared handles so we can close contexts in afterAll. Serial mode makes
  // this safe — tests run one at a time, no parallel-worker contention.
  const opened: PersonaHandle[] = [];

  test.afterAll(async () => {
    for (const h of opened) {
      await h.context.close().catch(() => {});
    }
  });

  async function openPersona(
    browser: Browser,
    persona: Persona
  ): Promise<PersonaHandle> {
    const h = await personaPage(browser, persona);
    opened.push(h);
    return h;
  }

  /**
   * Common setup for scoped-pull scenarios: opens dev, seeds a product +
   * answers on review-001 and review-999, pushes via syncNow.
   * Returns the stamp, question ID, and product UUID for assertions.
   */
  async function seedScopedScenario(
    browser: Browser,
    label: string
  ): Promise<{
    dev: PersonaHandle;
    q: string;
    productId: string;
  }> {
    const stamp = Date.now();
    const q = `q-${stamp}`;
    const productName = `[E2E] ${label} Product ${stamp}`;

    const dev = await openPersona(browser, PERSONAS.dev);

    const productId = await seedProduct(dev.page, {
      name: productName,
      teamIds: [],
    });
    await saveAnswer(dev.page, {
      reviewId: "review-001",
      questionId: q,
      answer: "yes",
    });
    await saveAnswer(dev.page, {
      reviewId: "review-999",
      questionId: q,
      answer: "no",
    });
    await syncNow(dev.page);

    return { dev, q, productId };
  }

  // ── 5.12 — #53 repro ────────────────────────────────────────────────────
  //
  // bob has product:* (wildcard) + review:review-001 (scoped). The old
  // entitled=nil collapse would fetch every family unfiltered, leaking
  // review-999 into bob's pull. The fix: product wildcard + review-001 exact,
  // never review-999.
  test("#53: bob (product:* + review:review-001) sees all products + review-001, never review-999", async ({
    browser,
  }) => {
    test.setTimeout(240_000);
    const { q, productId } = await seedScopedScenario(browser, "#53");
    const bob = await openPersona(browser, PERSONAS.bob);

    // Bob pulls and converges on the product + review-001 answer.
    // Search by UUID: ProductMutations pushes empty fields, so the name
    // doesn't survive sync — the handler stores entityId as the name.
    await test.step("bob sees product (product:* wildcard)", async () => {
      await expectSees(bob.page, "subjects", productId);
    });
    await test.step("bob sees review-001 answer (scoped entitlement)", async () => {
      await expectSees(bob.page, "review_answer_state", `review-001:${q}`);
    });

    // Bob never sees the review-999 answer (the #53 leak).
    await syncNow(bob.page);
    await test.step("bob does NOT see review-999 (no leak)", async () => {
      await expectDoesNotSee(
        bob.page,
        "review_answer_state",
        `review-999:${q}`
      );
    });
  });

  // ── 5.13 — #83 repro ────────────────────────────────────────────────────
  //
  // scoped has review:review-001 + product:prod-1 (no wildcards). A child of
  // review-999 must not ride along under the scoped review entitlement.
  test("#83: scoped (review:review-001 + product:prod-1) sees review-001 children, never review-999 or unentitled products", async ({
    browser,
  }) => {
    test.setTimeout(240_000);
    const { q, productId } = await seedScopedScenario(browser, "#83");
    const scoped = await openPersona(browser, PERSONAS.scoped);

    // Scoped sees the review-001 child, never the review-999 child.
    await test.step("scoped sees review-001 answer (entitled root)", async () => {
      await expectSees(scoped.page, "review_answer_state", `review-001:${q}`);
    });
    await syncNow(scoped.page);
    await test.step("scoped does NOT see review-999 (sibling root sealed)", async () => {
      await expectDoesNotSee(
        scoped.page,
        "review_answer_state",
        `review-999:${q}`
      );
    });
    await test.step("scoped does NOT see unentitled product (product:prod-1 only)", async () => {
      // Scoped has product:prod-1, not product:* — the UUID product does not leak.
      await expectDoesNotSee(scoped.page, "subjects", productId);
    });
  });

  // ── 5.14 — sealing + write→see loop ─────────────────────────────────────
  //
  // reviewonly has review:* only. A product event must not leak into the
  // review-only pull (I3 sealing). Then a write on review-001 converges to
  // scoped, but a write on review-999 does not.
  test("sealing + write→see: reviewonly sees reviews + zero products; scoped sees review-001 writes, not review-999", async ({
    browser,
  }) => {
    test.setTimeout(240_000);
    const { dev, q: q1, productId } = await seedScopedScenario(browser, "#14");
    const q2 = `q2-${Date.now()}`;

    const reviewonly = await openPersona(browser, PERSONAS.reviewonly);
    const scoped = await openPersona(browser, PERSONAS.scoped);

    // Sealing: reviewonly sees the review answer, never the product.
    await test.step("reviewonly sees review-001 answer (review:* wildcard)", async () => {
      await expectSees(
        reviewonly.page,
        "review_answer_state",
        `review-001:${q1}`
      );
    });
    await syncNow(reviewonly.page);
    await test.step("reviewonly does NOT see product (I3 sealing — review:* only)", async () => {
      await expectDoesNotSee(reviewonly.page, "subjects", productId);
    });

    // Write→see: a new review-001 answer converges to scoped.
    await saveAnswer(dev.page, {
      reviewId: "review-001",
      questionId: q2,
      answer: "no",
    });
    await syncNow(dev.page);
    await test.step("scoped sees new review-001 write (write→see convergence)", async () => {
      await expectSees(scoped.page, "review_answer_state", `review-001:${q2}`);
    });

    // A write on review-999 never reaches scoped.
    await saveAnswer(dev.page, {
      reviewId: "review-999",
      questionId: q2,
      answer: "no",
    });
    await syncNow(dev.page);
    await syncNow(scoped.page);
    await test.step("scoped does NOT see review-999 write (not entitled)", async () => {
      await expectDoesNotSee(
        scoped.page,
        "review_answer_state",
        `review-999:${q2}`
      );
    });
  });
});
