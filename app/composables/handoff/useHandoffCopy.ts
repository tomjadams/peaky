/**
 * useHandoffCopy — the primary, always-available handoff control
 * (improvement-plans/REQ-009, REQ-012; AC-034, AC-035, AC-045; design
 * Decision 7).
 *
 * A user-directed clipboard write of the ordered, provider-neutral Markdown
 * rendering. The action confirms success or surfaces a copy-failure state and
 * never alters the draft. It reads no runtime config because handoff controls
 * are never gated by a public flag.
 *
 * Group 10 wires this into the handoff UI: the caller supplies the current
 * draft snapshot and resolves route-style paths (the router owns those);
 * this composable resolves the origin from `window.location.origin` so the
 * renderer emits absolute deep links while staying environment-free.
 */
import { computed, ref, toValue, type MaybeRefOrGetter } from "vue";
import {
  renderHandoffMarkdown,
  type HandoffRenderContext,
} from "~/services/handoff/copyText";
import type { HandoffDraft } from "~/services/handoff/draft";

/** Copy outcome surfaced to the user (AC-045). */
export type HandoffCopyStatus = "idle" | "copied" | "failed";

export interface UseHandoffCopyOptions {
  /** The current synchronized draft snapshot. */
  readonly draft: MaybeRefOrGetter<HandoffDraft>;
  /** Path to the owning Review, when a review link should lead the text. */
  readonly reviewPath?: MaybeRefOrGetter<string | undefined>;
  /** Assessment deep-link path for one ordered draft practice. */
  readonly practicePath: HandoffRenderContext["practicePath"];
}

export function useHandoffCopy(options: UseHandoffCopyOptions) {
  const status = ref<HandoffCopyStatus>("idle");
  const failureReason = ref<string | null>(null);

  /** An empty selection has nothing to copy (AC-027). */
  const canCopy = computed(() => toValue(options.draft).kind === "ready");

  /**
   * Renders the current draft and writes it to the clipboard. Call this
   * from an explicit user gesture (click handler) — clipboard access is
   * gesture-gated by the browser. Returns whether the write succeeded; the
   * draft is read, never mutated.
   */
  async function copy(): Promise<boolean> {
    const draft = toValue(options.draft);

    let text: string;
    try {
      text = renderHandoffMarkdown(draft, {
        origin: window.location.origin,
        reviewPath: toValue(options.reviewPath),
        practicePath: options.practicePath,
      });
    } catch (error) {
      status.value = "failed";
      failureReason.value =
        error instanceof Error
          ? error.message
          : "The handoff draft could not be rendered.";
      return false;
    }

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      status.value = "failed";
      failureReason.value =
        "Copying to the clipboard failed. Check the browser's clipboard permission and try again.";
      return false;
    }

    status.value = "copied";
    failureReason.value = null;
    return true;
  }

  return { status, failureReason, canCopy, copy };
}
