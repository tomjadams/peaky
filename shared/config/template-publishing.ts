export function parseTemplatePublishingEnabled(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return false;
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") {
    throw new Error("NUXT_TEMPLATE_PUBLISHING_ENABLED must be true or false");
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  throw new Error("NUXT_TEMPLATE_PUBLISHING_ENABLED must be true or false");
}

export function assertTemplatePublishingConfigMatches(
  privateValue: unknown,
  publicValue: unknown
): void {
  if (
    parseTemplatePublishingEnabled(privateValue) !==
    parseTemplatePublishingEnabled(publicValue)
  ) {
    throw new Error(
      "Template publication private/public runtime config mismatch"
    );
  }
}
