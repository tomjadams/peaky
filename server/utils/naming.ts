const MAX_NAME_LENGTH = 120;

export const getUniqueName = (
  existingNames: string[],
  baseName: string,
  maxLength = MAX_NAME_LENGTH
): string => {
  const trimmedName = baseName.trim();
  const lowercasedExisting = new Set(existingNames.map((n) => n.toLowerCase()));

  if (!lowercasedExisting.has(trimmedName.toLowerCase())) {
    return trimmedName;
  }

  let suffix = 2;

  while (true) {
    const suffixLabel = ` (${suffix})`;
    const truncatedBase = trimmedName
      .slice(0, Math.max(0, maxLength - suffixLabel.length))
      .trimEnd();
    const candidate = `${truncatedBase}${suffixLabel}`;

    if (!lowercasedExisting.has(candidate.toLowerCase())) {
      return candidate;
    }

    suffix += 1;
  }
};
