/**
 * Sanitise error values for inclusion in `*Failed.v1` event payloads.
 *
 * Strips the bits we never want in a (potentially syncable) audit record:
 *
 * - Stack frames — paths leak repo layout, payloads bloat
 * - Absolute paths — leak environment/topology
 * - Email-shaped tokens — common PII spill from constraint errors
 *   ("UNIQUE constraint failed: users.email — value: jane@example.com")
 * - Long colon-tail values — "INSERT failed: ('foo', 'bar', '01HZ...')"
 *
 * Local-only callers (`_migration_log`, `console.error`) retain the full
 * unsanitised message for debugging.
 *
 * KNOWN LIMITATION (security-reviewer §4 finding): this is a regex
 * denylist; common error shapes can still pass PII through (e.g. error
 * messages with no colon, or with PII in a short trailing segment). Before
 * `*Failed.v1` events flip from local-only to actually pushed by the Rust
 * sync engine, replace this free-text `errorMessage` with a structured
 * `{ code, kind }` allow-list so PII cannot reach the wire by accident.
 * Tracked in roadmap.md under "Sync engine prerequisites".
 */
const ERROR_MESSAGE_MAX_LENGTH = 200;
// Email-shaped tokens — the most common PII spill from SQL constraint errors.
// Matches a contiguous run that contains an @ surrounded by non-whitespace.
const STRIP_EMAIL_LIKE = /\S+@\S+/g;
// Tail after a colon: 60+ non-colon chars to end-of-string. Threshold raised
// from 30 (ts-reviewer §4 finding) to reduce false positives on legitimate
// error suffixes ("invalid token at position 12 of input.txt"-style).
const STRIP_VALUE_TAIL = /:\s+[^:]{60,}$/;
const STRIP_PATH = /\/[^\s:]+/g;
const STRIP_STACK_FRAME = /\n\s+at\s.+/g;

export function sanitiseError(error: unknown): string {
  if (error == null) return "Unknown error";

  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Unknown error";

  // Order matters: tail-strip runs before path-strip because path-strip
  // shortens the message and would push a long tail under the threshold.
  // Stack-frame strip first because frame paths shouldn't influence either.
  const cleaned = raw
    .replace(STRIP_STACK_FRAME, "")
    .replace(STRIP_VALUE_TAIL, "")
    .replace(STRIP_EMAIL_LIKE, "<redacted>")
    .replace(STRIP_PATH, "<path>")
    .trim();

  if (cleaned.length === 0) return "Unknown error";
  return cleaned.length > ERROR_MESSAGE_MAX_LENGTH
    ? cleaned.slice(0, ERROR_MESSAGE_MAX_LENGTH - 1).trimEnd() + "…"
    : cleaned;
}
