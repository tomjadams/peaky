import type { RuleTester } from "oxlint/plugins-dev";

type OxlintRule = Parameters<RuleTester["run"]>[1];

export const enforceLocalMutationUow: OxlintRule;
export const noDirectTeamReviewCreate: OxlintRule;
export const noFallibleRemoteLocalPromiseAll: OxlintRule;

declare const plugin: {
  meta: { name: "peaky" };
  rules: {
    "enforce-local-mutation-uow": OxlintRule;
    "no-direct-team-review-create": OxlintRule;
    "no-fallible-remote-local-promise-all": OxlintRule;
  };
};

export default plugin;
