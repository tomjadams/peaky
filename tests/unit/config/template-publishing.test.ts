import { describe, expect, it } from "vitest";
import {
  assertTemplatePublishingConfigMatches,
  parseTemplatePublishingEnabled,
} from "#shared/config/template-publishing";

describe("parseTemplatePublishingEnabled", () => {
  it.each([
    [undefined, false],
    [null, false],
    ["", false],
    [false, false],
    ["false", false],
    [" FALSE ", false],
    [true, true],
    ["true", true],
    [" TRUE ", true],
  ])("parses %j as %j", (value, expected) => {
    expect(parseTemplatePublishingEnabled(value)).toBe(expected);
  });

  it.each(["1", "yes", 1, {}])("rejects unsupported value %j", (value) => {
    expect(() => parseTemplatePublishingEnabled(value)).toThrow(
      /must be true or false/
    );
  });
});

describe("assertTemplatePublishingConfigMatches", () => {
  it.each([
    [false, false],
    [true, true],
    ["false", false],
    ["true", true],
  ])("accepts matching values %j and %j", (privateValue, publicValue) => {
    expect(() =>
      assertTemplatePublishingConfigMatches(privateValue, publicValue)
    ).not.toThrow();
  });

  it.each([
    [false, true],
    [true, false],
  ])("rejects drift between %j and %j", (privateValue, publicValue) => {
    expect(() =>
      assertTemplatePublishingConfigMatches(privateValue, publicValue)
    ).toThrow(/runtime config mismatch/);
  });
});
