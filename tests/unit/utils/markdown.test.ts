import { describe, expect, it } from "vitest";
import {
  escapeMarkdownInline,
  markdownLink,
  markdownTableCell,
  parseMarkdownDestination,
  unescapeMarkdownInline,
} from "~/utils/markdown";

describe("Markdown utilities", () => {
  it("escapes inline text, table separators, and link destinations", () => {
    expect(escapeMarkdownInline("A  [label] <value> & more")).toBe(
      "A \\[label\\] &lt;value&gt; &amp; more"
    );
    expect(markdownTableCell("A | B")).toBe("A \\| B");
    expect(markdownLink("Open [review]", "https://example.com/a<b>")).toBe(
      "[Open \\[review\\]](<https://example.com/a%3Cb%3E>)"
    );
    expect(unescapeMarkdownInline("Open \\[review\\] &amp; notes")).toBe(
      "Open [review] & notes"
    );
    expect(parseMarkdownDestination("<https://example.com/a%3Cb%3E>")).toBe(
      "https://example.com/a%3Cb%3E"
    );
  });
});
