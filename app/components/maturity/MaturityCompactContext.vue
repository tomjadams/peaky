<script setup lang="ts">
/**
 * Flat per-Review Revision context for team and product Follow-ups
 * (maturity-score/REQ-014; AC-039, AC-062, AC-068).
 *
 * Every pinned Revision keeps its own visible identity and return link. The
 * component presents projected values only. It never combines Revisions.
 */
import type { RouteLocationRaw } from "vue-router";
import {
  COMPACT_STATE_LABEL,
  compactEntryContextLabel,
  type CompactMaturityEntry,
} from "~/services/maturity/compactContext";

interface Props {
  entries: readonly CompactMaturityEntry[];
  /** Return path to the owning Review's Follow-ups page. */
  to: RouteLocationRaw;
  /** Review name used to distinguish repeated return links. */
  reviewName?: string;
}

const props = defineProps<Props>();

const stateLabel = (kind: CompactMaturityEntry["kind"]): string | null =>
  kind === "result" ? null : COMPACT_STATE_LABEL[kind];

const shortIdentifier = (identifier: string): string =>
  identifier.length > 18
    ? `${identifier.slice(0, 8)}…${identifier.slice(-4)}`
    : identifier;

const visibleRevisionLabel = (entry: CompactMaturityEntry): string => {
  if (!entry.label.startsWith(entry.templateRevisionId)) return entry.label;
  const revision = entry.label.slice(entry.templateRevisionId.length + 3);
  return `${revision || "Pinned Revision"} · ${shortIdentifier(entry.templateRevisionId)}`;
};

const returnLinkLabel = (entry: CompactMaturityEntry): string => {
  const context = compactEntryContextLabel(entry) ?? "Result unavailable";
  const destination = props.reviewName
    ? `Follow-ups for ${props.reviewName}`
    : "Review Follow-ups";
  return `${entry.label}. ${context}. Open ${destination}`;
};

const toForEntry = (entry: CompactMaturityEntry): RouteLocationRaw => {
  if (typeof props.to === "string") {
    const [path, hash] = props.to.split("#", 2);
    const separator = path!.includes("?") ? "&" : "?";
    const target = `${path}${separator}templateRevisionId=${encodeURIComponent(entry.templateRevisionId)}`;
    return hash ? `${target}#${hash}` : target;
  }

  return {
    ...props.to,
    query: {
      ...("query" in props.to ? props.to.query : undefined),
      templateRevisionId: entry.templateRevisionId,
    },
  } as RouteLocationRaw;
};
</script>

<template>
  <div class="maturity-compact min-w-0">
    <NuxtLink
      v-for="entry in entries"
      :key="entry.templateRevisionId"
      :to="toForEntry(entry)"
      class="border-default focus-visible:ring-primary group flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 border-t py-1.5 text-[13px] leading-5 transition-colors first:border-t-0 focus-visible:rounded-[7px] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      :aria-label="returnLinkLabel(entry)"
    >
      <span
        class="text-primary max-w-full min-w-0 basis-full font-semibold break-words group-hover:underline sm:basis-auto"
        :title="entry.label"
      >
        {{ visibleRevisionLabel(entry) }}
      </span>

      <template v-if="entry.kind === 'result'">
        <span
          class="shrink-0 font-semibold text-sky-600 tabular-nums dark:text-sky-400"
        >
          {{ entry.displayPercent }}%
        </span>
        <span class="text-default font-medium">
          Stage {{ entry.stage }} · {{ entry.stageName }}
        </span>
        <span v-if="entry.coverage" class="text-muted tabular-nums">
          {{ entry.coverage.answered }}/{{ entry.coverage.total }} answered
        </span>
        <span v-if="entry.provisional" class="text-muted font-medium">
          Provisional
        </span>
        <span
          v-if="entry.advisorReviewed"
          class="text-primary inline-flex items-center gap-1 font-medium"
        >
          <UIcon
            name="i-lucide-shield-check"
            class="h-3.5 w-3.5"
            aria-hidden="true"
          />
          Advisor reviewed
        </span>
      </template>
      <template v-else>
        <span class="text-default font-semibold">
          {{ stateLabel(entry.kind) }}
        </span>
        <span v-if="entry.coverage" class="text-muted tabular-nums">
          {{ entry.coverage.answered }}/{{ entry.coverage.total }} answered
        </span>
      </template>
    </NuxtLink>
  </div>
</template>
