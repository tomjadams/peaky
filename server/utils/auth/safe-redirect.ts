const DEFAULT_REDIRECT = "/teams";

export function resolveSafeRedirect(value: unknown, origin: string): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return DEFAULT_REDIRECT;
  }

  try {
    const target = new URL(value, origin);
    if (target.origin !== origin) return DEFAULT_REDIRECT;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return DEFAULT_REDIRECT;
  }
}
