import { useIntersectionObserver } from "@vueuse/core";
import type { MaybeComputedElementRef } from "@vueuse/core";

export interface UseRevealOnceOptions {
  /** Intersection ratio required before the target counts as "revealed". */
  threshold?: number;
  /** Shrinks (negative values) or grows the root's box before intersection
   * is computed — e.g. `"0px 0px -20% 0px"` holds off reveal until the
   * target has scrolled 20% up from the viewport's bottom edge, instead of
   * firing the moment its first pixel is visible. */
  rootMargin?: string;
}

/**
 * True once `target` has crossed `threshold` intersection with the viewport,
 * then stays true — used to drive one-time scroll-reveal animations without
 * re-triggering (or reverting) as the user scrolls back and forth.
 */
export function useRevealOnce(
  target: MaybeComputedElementRef,
  options: UseRevealOnceOptions = {}
) {
  const { threshold = 0.25, rootMargin = "0px" } = options;
  const revealed = ref(false);

  const { stop } = useIntersectionObserver(
    target,
    ([entry]) => {
      if (entry?.isIntersecting) {
        revealed.value = true;
        stop();
      }
    },
    { threshold, rootMargin }
  );

  return revealed;
}
