import { describe, it } from "vitest";
import { RuleTester } from "oxlint/plugins-dev";
import { noFallibleRemoteLocalPromiseAll } from "../../../oxlint-plugins/peaky-plugin.mjs";

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { sourceType: "module" },
});

ruleTester.run(
  "no-fallible-remote-local-promise-all",
  noFallibleRemoteLocalPromiseAll,
  {
    valid: [
      `
        const local = await reviewRepository.fetchSubjectReviews(id);
        if (local.length === 0) await $fetch("/api/teams/" + id + "/reviews");
      `,
      `await Promise.all([$fetch("/api/one"), $fetch("/api/two")]);`,
      `await Promise.all([
        reviewRepository.fetchSubjectReviews(id),
        fetchLocalTemplateDrafts(),
      ]);`,
      `await Promise.all([
        $fetch("/api/templates").catch(() => []),
        fetchLocalTemplateDrafts(),
      ]);`,
      `await Promise.all([
        $fetch("/api/templates").catch((error) => {
          fetchError = error;
          return { templates: [] };
        }),
        fetchLocalTemplateDrafts(),
      ]);`,
      `await Promise.all([
        $fetch("/api/templates").catch(() => undefined),
        fetchLocalTemplateDrafts(),
      ]);`,
      `await Promise.allSettled([
        $fetch("/api/reviews"),
        reviewRepository.fetchSubjectReviews(id),
      ]);`,
      `await Promise.all([
        $fetch("/api/reviews").then(() => localRepository.save()),
      ]);`,
      `await Promise.all([
        $fetch("/api/reviews"),
        localeCompare("a", "b"),
        formatLocalDate(date),
        getLocalizedLabel(value),
      ]);`,
    ],
    invalid: [
      {
        code: `
          await Promise.all([
            $fetch("/api/reviews").catch((error) => {
              if (error.message.includes("404")) return null;
              throw error;
            }),
            reviewRepository.fetchSubjectReviews(id),
          ]);
        `,
        errors: [{ messageId: "preferLocalFirst" }],
      },
      {
        code: `await Promise.all([
          $fetch("/api/reviews"),
          reviewRepository.fetchSubjectReviews(id),
        ]);`,
        errors: [{ messageId: "preferLocalFirst" }],
      },
      {
        code: `await Promise.all([fetch("/api/reviews"), fetchLocalReviews(id)]);`,
        errors: [{ messageId: "preferLocalFirst" }],
      },
      {
        code: `await Promise.all([
          $fetch.raw("/api/reviews"),
          fetchLocalReviews(id),
        ]);`,
        errors: [{ messageId: "preferLocalFirst" }],
      },
      {
        code: `await Promise.all([
          fetch.call(null, "/api/reviews"),
          fetchLocalReviews(id),
        ]);`,
        errors: [{ messageId: "preferLocalFirst" }],
      },
      {
        code: `await Promise.all([
          $fetch("/api/reviews").catch(() => Promise.reject(new Error("offline"))),
          withDatabase((db) => db.select()),
        ]);`,
        errors: [{ messageId: "preferLocalFirst" }],
      },
      {
        code: `await Promise.all([
          $fetch("/api/reviews").catch(() => {
            throw new Error("offline");
          }),
          fetchLocalReviews(id),
        ]);`,
        errors: [{ messageId: "preferLocalFirst" }],
      },
      {
        code: `await Promise.all([
          $fetch("/api/reviews").catch(async () => []),
          fetchLocalReviews(id),
        ]);`,
        errors: [{ messageId: "preferLocalFirst" }],
      },
      {
        code: `await Promise.all([
          $fetch("/api/reviews").catch(() => recoverFromFailure()),
          fetchLocalReviews(id),
        ]);`,
        errors: [{ messageId: "preferLocalFirst" }],
      },
      {
        code: `await Promise.all([
          $fetch("/api/reviews").catch(() => fallback),
          fetchLocalReviews(id),
        ]);`,
        errors: [{ messageId: "preferLocalFirst" }],
      },
      {
        code: `await Promise.all([
          $fetch("/api/reviews").catch(toEmptyList),
          fetchLocalReviews(id),
        ]);`,
        errors: [{ messageId: "preferLocalFirst" }],
      },
      {
        code: `await Promise.all([
          $fetch("/api/reviews").catch(() => []).then(normalize),
          fetchLocalReviews(id),
        ]);`,
        errors: [{ messageId: "preferLocalFirst" }],
      },
    ],
  }
);
