<script setup lang="ts">
import { computed } from "vue";

interface Props {
  open: boolean;
  title: string;
  description: string;
  detailsTitle: string;
  detailsDescription: string;
  confirmLabel: string;
  confirmIcon?: string;
  confirmColor?: "primary" | "warning";
  loading?: boolean;
  closeDisabled?: boolean;
  tone?: "primary" | "warning";
}

const props = withDefaults(defineProps<Props>(), {
  confirmIcon: "i-lucide-archive",
  confirmColor: "primary",
  loading: false,
  closeDisabled: false,
  tone: "primary",
});

const emit = defineEmits<{
  "update:open": [value: boolean];
  confirm: [];
}>();

const toneClasses = computed(() => {
  if (props.tone === "warning") {
    return {
      wrapper:
        "rounded-lg border border-[#EDDCC0] bg-[#FDF3E3] p-4 dark:border-amber-900/60 dark:bg-amber-950/20",
      iconWrapper:
        "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40",
      icon: "h-4 w-4 text-amber-700 dark:text-amber-200",
    };
  }

  return {
    wrapper: "border-default rounded-lg border p-4",
    iconWrapper:
      "bg-primary/10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full",
    icon: "text-primary h-4 w-4",
  };
});

function close() {
  emit("update:open", false);
}
</script>

<template>
  <UModal
    :open="open"
    :ui="{ content: 'max-w-lg' }"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div class="space-y-4 p-1">
        <div>
          <h3
            class="text-default text-base font-semibold"
            role="heading"
            aria-level="3"
          >
            {{ title }}
          </h3>
          <p class="text-muted mt-0.5 text-sm">{{ description }}</p>
        </div>

        <div :class="toneClasses.wrapper">
          <div class="flex items-start gap-3">
            <div :class="toneClasses.iconWrapper">
              <Icon
                name="lucide:archive"
                :class="toneClasses.icon"
                aria-hidden="true"
              />
            </div>
            <div class="space-y-1">
              <p class="text-default text-sm font-medium">{{ detailsTitle }}</p>
              <p class="text-muted text-sm">{{ detailsDescription }}</p>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full items-center justify-end gap-2">
        <UButton
          size="md"
          color="neutral"
          variant="ghost"
          :disabled="closeDisabled"
          @click="close"
        >
          Cancel
        </UButton>
        <UButton
          :color="confirmColor"
          :icon="confirmIcon"
          :loading="loading"
          @click="emit('confirm')"
        >
          {{ confirmLabel }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
