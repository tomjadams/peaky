export type ResolvedColorMode = "light" | "dark";

export function resolveColorMode(
  value: string | null | undefined
): ResolvedColorMode {
  return value === "dark" ? "dark" : "light";
}

export function nextColorMode(
  value: string | null | undefined
): ResolvedColorMode {
  return resolveColorMode(value) === "dark" ? "light" : "dark";
}
