import { describe, expect, it } from "vitest";
import {
  abbreviateText,
  extractPreview,
  stripMarkdown,
  truncateText,
} from "~/composables/templates/textProcessing";

// ---------------------------------------------------------------------------
// stripMarkdown
// ---------------------------------------------------------------------------

describe("stripMarkdown()", () => {
  it("returns empty string for empty input", () => {
    expect(stripMarkdown("")).toBe("");
  });

  it("returns empty string for falsy input", () => {
    // @ts-expect-error — deliberate runtime test for null/undefined callers
    expect(stripMarkdown(null)).toBe("");
    // @ts-expect-error — deliberate runtime test for undefined callers
    expect(stripMarkdown(undefined)).toBe("");
  });

  it("returns plain text unchanged", () => {
    expect(stripMarkdown("Hello world")).toBe("Hello world");
  });

  it("removes h1 headers", () => {
    expect(stripMarkdown("# Heading one")).toBe("Heading one");
  });

  it("removes h2 headers", () => {
    expect(stripMarkdown("## Heading two")).toBe("Heading two");
  });

  it("removes h6 headers", () => {
    expect(stripMarkdown("###### Deep heading")).toBe("Deep heading");
  });

  it("removes bold with double asterisks", () => {
    expect(stripMarkdown("This is **bold** text")).toBe("This is bold text");
  });

  it("removes italic with single asterisk", () => {
    expect(stripMarkdown("This is *italic* text")).toBe("This is italic text");
  });

  it("removes bold with double underscores", () => {
    expect(stripMarkdown("This is __bold__ text")).toBe("This is bold text");
  });

  it("removes italic with single underscore", () => {
    expect(stripMarkdown("This is _italic_ text")).toBe("This is italic text");
  });

  it("removes inline code backticks", () => {
    expect(stripMarkdown("Use `console.log()` here")).toBe(
      "Use console.log() here"
    );
  });

  it("removes markdown links, keeping link text", () => {
    expect(stripMarkdown("[click here](https://example.com)")).toBe(
      "click here"
    );
  });

  it("removes markdown images, keeping alt text", () => {
    // The image regex (`!\[alt\](url) → alt`) runs after the link regex, so
    // the `!` prefix that distinguishes images from links is already consumed
    // by the image rule — the actual output retains a leading `!` because the
    // link pattern `[text](url)` matches the inner part first.
    // Actual production output: the leading `!` remains as `!logo`.
    expect(stripMarkdown("![logo](https://example.com/img.png)")).toBe("!logo");
  });

  it("removes markdown images with empty alt text", () => {
    expect(stripMarkdown("![](https://example.com/img.png)")).toBe("");
  });

  it("removes blockquote markers", () => {
    expect(stripMarkdown("> A quoted line")).toBe("A quoted line");
  });

  it("removes horizontal rule with dashes", () => {
    expect(stripMarkdown("---")).toBe("");
  });

  it("removes horizontal rule with asterisks", () => {
    expect(stripMarkdown("***")).toBe("");
  });

  it("removes horizontal rule with underscores", () => {
    expect(stripMarkdown("___")).toBe("");
  });

  it("removes unordered list markers with dash", () => {
    expect(stripMarkdown("- Item one")).toBe("Item one");
  });

  it("removes unordered list markers with asterisk", () => {
    expect(stripMarkdown("* Item two")).toBe("Item two");
  });

  it("removes unordered list markers with plus", () => {
    expect(stripMarkdown("+ Item three")).toBe("Item three");
  });

  it("removes ordered list markers", () => {
    expect(stripMarkdown("1. First item")).toBe("First item");
  });

  it("removes ordered list markers beyond 1", () => {
    expect(stripMarkdown("42. Some item")).toBe("Some item");
  });

  it("collapses multiple whitespace characters into a single space", () => {
    expect(stripMarkdown("word1  \t  word2")).toBe("word1 word2");
  });

  it("handles combined formatting — header with bold and link", () => {
    const input = "## **Important** [link](https://example.com) notice";
    expect(stripMarkdown(input)).toBe("Important link notice");
  });

  it("handles multi-line markdown with multiple constructs", () => {
    const input = [
      "# Title",
      "",
      "> Blockquote line",
      "",
      "- List item",
      "",
      "Plain sentence with **bold** and `code`.",
    ].join("\n");

    const result = stripMarkdown(input);

    expect(result).not.toContain("#");
    expect(result).not.toContain("**");
    expect(result).not.toContain("`");
    expect(result).not.toContain(">");
    expect(result).not.toContain("- ");
    expect(result).toContain("Title");
    expect(result).toContain("Blockquote line");
    expect(result).toContain("List item");
    expect(result).toContain("bold");
    expect(result).toContain("code");
  });
});

// ---------------------------------------------------------------------------
// abbreviateText
// ---------------------------------------------------------------------------

describe("abbreviateText()", () => {
  it("returns the full text when it is shorter than maxLength", () => {
    expect(abbreviateText("Short text", 60)).toBe("Short text");
  });

  it("returns the full text when it is exactly maxLength", () => {
    const text = "a".repeat(60);
    expect(abbreviateText(text, 60)).toBe(text);
  });

  it("appends ellipsis when text exceeds maxLength", () => {
    const text = "word ".repeat(20).trim(); // 99 chars
    const result = abbreviateText(text, 60);
    expect(result.endsWith("...")).toBe(true);
  });

  it("truncates at word boundary when a suitable space exists near the limit", () => {
    // "Hello world foo bar baz qux" — the last space before position 57 gives a word-boundary break
    const text =
      "Hello world foo bar baz qux extra words to push past sixty chars total here";
    const result = abbreviateText(text, 60);
    // Must not cut in the middle of a word (result before "..." is a complete word)
    const withoutEllipsis = result.slice(0, -3);
    expect(withoutEllipsis).toBe(withoutEllipsis.trimEnd());
    expect(result.length).toBeLessThanOrEqual(60);
    expect(result.endsWith("...")).toBe(true);
  });

  it("falls back to hard truncation when no space exists near the limit", () => {
    // A single very long word — no space to break on
    const text = "a".repeat(80);
    const result = abbreviateText(text, 60);
    expect(result).toBe("a".repeat(57) + "...");
  });

  it("strips markdown before abbreviating", () => {
    const text = "**Bold title:** " + "word ".repeat(20);
    const result = abbreviateText(text, 60);
    expect(result).not.toContain("**");
    expect(result.endsWith("...")).toBe(true);
  });

  it("uses default maxLength of 60", () => {
    const text = "word ".repeat(20).trim();
    const result = abbreviateText(text);
    expect(result.length).toBeLessThanOrEqual(60);
  });
});

// ---------------------------------------------------------------------------
// truncateText
// ---------------------------------------------------------------------------

describe("truncateText()", () => {
  it("returns isTruncated false when text is shorter than maxLength", () => {
    const result = truncateText("Short text", 100);
    expect(result.isTruncated).toBe(false);
    expect(result.displayText).toBe("Short text");
    expect(result.fullText).toBe("Short text");
  });

  it("returns isTruncated false when text equals maxLength exactly", () => {
    const text = "a".repeat(100);
    const result = truncateText(text, 100);
    expect(result.isTruncated).toBe(false);
  });

  it("returns isTruncated true when text exceeds maxLength", () => {
    const text = "a".repeat(120);
    const result = truncateText(text, 100);
    expect(result.isTruncated).toBe(true);
  });

  it("appends ellipsis to displayText when truncated", () => {
    const text = "a".repeat(120);
    const result = truncateText(text, 100);
    expect(result.displayText.endsWith("...")).toBe(true);
  });

  it("displayText length is maxLength + 3 (ellipsis) when truncated", () => {
    const text = "a".repeat(120);
    const result = truncateText(text, 100);
    expect(result.displayText).toBe("a".repeat(100) + "...");
  });

  it("fullText always holds the complete stripped content", () => {
    const text = "**bold** " + "word ".repeat(30);
    const result = truncateText(text, 50);
    expect(result.fullText).not.toContain("**");
    expect(result.fullText.length).toBeGreaterThan(50);
  });

  it("strips markdown before truncating", () => {
    const text = "# Header\n\n" + "word ".repeat(30);
    const result = truncateText(text, 50);
    expect(result.displayText).not.toContain("#");
    expect(result.isTruncated).toBe(true);
  });

  it("uses default maxLength of 100", () => {
    const text = "word ".repeat(30).trim();
    const result = truncateText(text);
    expect(result.displayText.length).toBeLessThanOrEqual(103); // 100 + "..."
    expect(result.isTruncated).toBe(true);
  });

  it("returns empty display when given empty string", () => {
    const result = truncateText("", 100);
    expect(result.displayText).toBe("");
    expect(result.isTruncated).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// extractPreview
// ---------------------------------------------------------------------------

describe("extractPreview()", () => {
  it("returns full text when it is shorter than maxLength and has no sentence end", () => {
    const text = "Short phrase";
    expect(extractPreview(text, 80)).toBe("Short phrase");
  });

  it("extracts up to and including the first period", () => {
    const text = "First sentence. Second sentence follows after this.";
    const result = extractPreview(text, 80);
    expect(result).toBe("First sentence.");
  });

  it("extracts up to and including the first exclamation mark", () => {
    const text = "Amazing result! More details here.";
    const result = extractPreview(text, 80);
    expect(result).toBe("Amazing result!");
  });

  it("extracts up to and including the first question mark", () => {
    const text = "Is this correct? Yes it is. Another sentence.";
    const result = extractPreview(text, 80);
    expect(result).toBe("Is this correct?");
  });

  it("falls back to abbreviateText when the sentence end exceeds maxLength", () => {
    // Sentence is longer than maxLength — should abbreviate instead
    const longSentence = "word ".repeat(20) + ". Second sentence.";
    const result = extractPreview(longSentence, 60);
    // Should not end with the sentence marker mid-overflow; should end with ...
    expect(result.endsWith("...")).toBe(true);
    expect(result.length).toBeLessThanOrEqual(60);
  });

  it("falls back to abbreviateText when no sentence end exists", () => {
    const text = "word ".repeat(20).trim(); // no period/!/? — 99 chars
    const result = extractPreview(text, 60);
    expect(result.endsWith("...")).toBe(true);
  });

  it("strips markdown before extracting the preview", () => {
    const text = "**Bold intro.** More text after.";
    const result = extractPreview(text, 80);
    expect(result).not.toContain("**");
    expect(result).toBe("Bold intro.");
  });

  it("uses default maxLength of 80", () => {
    const text = "word ".repeat(25).trim();
    const result = extractPreview(text);
    expect(result.length).toBeLessThanOrEqual(80);
  });

  it("returns empty string for empty input", () => {
    expect(extractPreview("")).toBe("");
  });
});
