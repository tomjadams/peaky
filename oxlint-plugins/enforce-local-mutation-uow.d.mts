import type { RuleTester } from "oxlint/plugins-dev";

type OxlintRule = Parameters<RuleTester["run"]>[1];

export const enforceLocalMutationUow: OxlintRule;
