export function escapeMarkdownInline(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replace(/([\\[\]])/g, "\\$1");
}

export function unescapeMarkdownInline(value: string): string {
  return value
    .replace(/\\([\\[\]])/g, "$1")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

export function markdownDestination(url: string): string {
  return `<${url.replaceAll("<", "%3C").replaceAll(">", "%3E")}>`;
}

export function parseMarkdownDestination(value: string): string {
  return value.startsWith("<") && value.endsWith(">")
    ? value.slice(1, -1)
    : value;
}

export function markdownLink(label: string, url: string): string {
  return `[${escapeMarkdownInline(label)}](${markdownDestination(url)})`;
}

export function markdownTableCell(value: string): string {
  return escapeMarkdownInline(value).replaceAll("|", "\\|");
}
