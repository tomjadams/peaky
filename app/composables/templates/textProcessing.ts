/**
 * Text Utilities for Template Studio
 *
 * Shared functions for text processing across components.
 */

/**
 * Strip markdown formatting from text
 * Returns plain text without markdown syntax
 */
export function stripMarkdown(text: string): string {
  if (!text) return "";

  return (
    text
      // Remove headers (# ## ### etc)
      .replace(/^#{1,6}\s+/gm, "")
      // Remove bold/italic (**text**, *text*, __text__, _text_)
      .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, "$1")
      // Remove inline code (`code`)
      .replace(/`([^`]+)`/g, "$1")
      // Remove links [text](url) → text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      // Remove images ![alt](url) → alt
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
      // Remove blockquotes (> text)
      .replace(/^>\s+/gm, "")
      // Remove horizontal rules (--- *** ___)
      .replace(/^[-*_]{3,}$/gm, "")
      // Remove list markers (- * +)
      .replace(/^[\s]*[-*+]\s+/gm, "")
      // Remove numbered list markers (1. 2. etc)
      .replace(/^[\s]*\d+\.\s+/gm, "")
      // Clean up extra whitespace
      .replace(/\s+/g, " ")
      .trim()
  );
}

/**
 * Abbreviate text to a maximum length
 * Appends ellipsis if text is truncated
 */
export function abbreviateText(text: string, maxLength = 60): string {
  const stripped = stripMarkdown(text);

  if (stripped.length <= maxLength) {
    return stripped;
  }

  // Find a good break point (space) near the max length
  const breakPoint = stripped.lastIndexOf(" ", maxLength - 3);

  if (breakPoint > maxLength / 2) {
    return stripped.slice(0, breakPoint) + "...";
  }

  return stripped.slice(0, maxLength - 3) + "...";
}

/**
 * Truncate text with "Read more" / "Show less" support
 * Returns object with display text and whether it was truncated
 */
export function truncateText(
  text: string,
  maxLength = 100
): { displayText: string; isTruncated: boolean; fullText: string } {
  const stripped = stripMarkdown(text);

  if (stripped.length <= maxLength) {
    return {
      displayText: stripped,
      isTruncated: false,
      fullText: stripped,
    };
  }

  return {
    displayText: stripped.slice(0, maxLength) + "...",
    isTruncated: true,
    fullText: stripped,
  };
}

/**
 * Extract the first sentence or phrase from text
 * Useful for previews and tooltips
 */
export function extractPreview(text: string, maxLength = 80): string {
  const stripped = stripMarkdown(text);

  // Try to find end of first sentence
  const sentenceEnd = stripped.search(/[.!?]\s/);

  if (sentenceEnd > 0 && sentenceEnd < maxLength) {
    return stripped.slice(0, sentenceEnd + 1);
  }

  return abbreviateText(stripped, maxLength);
}
