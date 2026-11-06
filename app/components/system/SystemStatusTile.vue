<script setup lang="ts">
/**
 * Glance tile for /system. Renders one of the four engine signals
 * (Database, Schema, Storage, Sync) with:
 * - one-word headline (e.g. "Healthy", "Up to date", "In sync")
 * - support line below the headline
 * - optional contextual link slot
 * - optional "What is this?" expander with educational copy
 *
 * Visual state is derived from `tone`: green/amber/red/neutral. Avoids
 * raw colour tokens at the call site so /system stays consistent.
 */
type Tone = "ok" | "warn" | "error" | "neutral";

interface Props {
  /** Lucide icon name (e.g. "lucide:database", "lucide:database-zap"). */
  icon: string;
  /** Card label rendered as kicker (e.g. "Database", "Schema"). */
  label: string;
  /** One-word state (e.g. "Healthy", "Up to date"). */
  headline: string;
  /** Supporting line under the headline. */
  support?: string;
  /** Visual tone — picks the badge colour. Default neutral. */
  tone?: Tone;
  /** Educational copy for the "What is this?" expander. Plain language. */
  whatIsThis?: string;
}

const props = withDefaults(defineProps<Props>(), {
  support: "",
  tone: "neutral",
  whatIsThis: "",
});

const TONE_COLOR: Record<Tone, "success" | "warning" | "error" | "neutral"> = {
  ok: "success",
  warn: "warning",
  error: "error",
  neutral: "neutral",
};

const dotColor = computed(() => TONE_COLOR[props.tone]);
</script>

<template>
  <UCard
    :ui="{
      body: 'flex h-full flex-col gap-2 p-4',
    }"
  >
    <div class="flex items-center gap-2">
      <UBadge :color="dotColor" variant="subtle" size="sm">
        <Icon :name="icon" class="h-3.5 w-3.5" />
      </UBadge>
      <p class="text-dimmed text-sm font-semibold">
        {{ label }}
      </p>
    </div>

    <p class="text-default text-lg font-semibold">{{ headline }}</p>
    <p v-if="support" class="text-muted text-sm">{{ support }}</p>

    <slot name="contextual-link" />

    <UCollapsible v-if="whatIsThis" class="mt-auto">
      <template #default="{ open }">
        <button
          type="button"
          class="text-muted hover:text-default flex items-center gap-1 text-xs transition-colors"
        >
          <Icon
            :name="open ? 'lucide:chevron-down' : 'lucide:chevron-right'"
            class="h-3 w-3"
          />
          What is this?
        </button>
      </template>
      <template #content>
        <p class="text-muted mt-2 text-xs leading-relaxed">
          {{ whatIsThis }}
        </p>
      </template>
    </UCollapsible>
  </UCard>
</template>
