import { describe, it } from "vitest";
import { RuleTester } from "oxlint/plugins-dev";
import { noDirectTeamReviewCreate } from "../../../oxlint-plugins/peaky-plugin.mjs";

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { sourceType: "module" },
});

ruleTester.run("no-direct-team-review-create", noDirectTeamReviewCreate, {
  valid: [
    `await teamReviewService.create({ team, name, templateRevisionIds, scope, applicationIds });`,
    `await reviewMutations.create({ subjectType: "product", subjectId, name, templateRevisionIds });`,
  ],
  invalid: [
    {
      code: `await reviewMutations.create({
        subjectId: team.id,
        subjectType: "team",
        name,
        templateRevisionIds,
      });`,
      errors: [{ messageId: "useTeamReviewService" }],
    },
  ],
});
