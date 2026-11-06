<script setup lang="ts">
interface Props {
  open: boolean;
  title: string;
  description: string;
  warningTitle: string;
  warningDescription?: string;
  warningItems?: string[];
  resourceTitle?: string;
  resourceDescription?: string;
  resourceSecondaryDescription?: string;
  confirmationInputId: string;
  confirmationTarget: string;
  confirmationValue: string;
  confirmationPlaceholder?: string;
  confirmationHelp?: string;
  confirmLabel: string;
  loading?: boolean;
  closeDisabled?: boolean;
  confirmDisabled?: boolean;
}

withDefaults(defineProps<Props>(), {
  warningDescription: undefined,
  warningItems: () => [],
  resourceTitle: undefined,
  resourceDescription: undefined,
  resourceSecondaryDescription: undefined,
  confirmationPlaceholder: undefined,
  confirmationHelp: undefined,
  loading: false,
  closeDisabled: false,
  confirmDisabled: false,
});

const emit = defineEmits<{
  "update:open": [value: boolean];
  "update:confirmationValue": [value: string];
  confirm: [];
}>();

function close() {
  emit("update:open", false);
}
</script>

<template>
  <UModal
    :open="open"
    :title="title"
    :description="description"
    :ui="{ content: 'max-w-lg' }"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div class="space-y-4 p-1">
        <div
          class="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/60 dark:bg-red-950/20"
        >
          <div class="flex items-start gap-3">
            <div
              class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/40"
            >
              <Icon
                name="lucide:trash-2"
                class="h-4 w-4 text-red-600 dark:text-red-300"
                aria-hidden="true"
              />
            </div>
            <div class="space-y-1">
              <p class="text-default text-sm font-medium">{{ warningTitle }}</p>
              <p v-if="warningDescription" class="text-muted text-sm">
                {{ warningDescription }}
              </p>
              <ul
                v-if="warningItems.length > 0"
                class="text-muted list-disc space-y-1 pl-5 text-sm"
              >
                <li v-for="item in warningItems" :key="item">{{ item }}</li>
              </ul>
            </div>
          </div>
        </div>

        <div
          v-if="
            resourceTitle || resourceDescription || resourceSecondaryDescription
          "
          class="bg-elevated border-default rounded-lg border p-4"
        >
          <p v-if="resourceTitle" class="text-default text-sm font-medium">
            {{ resourceTitle }}
          </p>
          <p v-if="resourceDescription" class="text-muted mt-1 text-sm">
            {{ resourceDescription }}
          </p>
          <p v-if="resourceSecondaryDescription" class="text-muted text-sm">
            {{ resourceSecondaryDescription }}
          </p>
        </div>

        <div class="space-y-2">
          <label
            :for="confirmationInputId"
            class="text-default block text-sm font-medium"
          >
            Type <span class="font-semibold">{{ confirmationTarget }}</span>
            to confirm permanent delete
          </label>
          <UInput
            :id="confirmationInputId"
            :model-value="confirmationValue"
            :placeholder="confirmationPlaceholder ?? confirmationTarget"
            :disabled="loading"
            autocomplete="off"
            @update:model-value="
              emit('update:confirmationValue', String($event))
            "
          />
          <p v-if="confirmationHelp" class="text-muted text-[13px]">
            {{ confirmationHelp }}
          </p>
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
          color="error"
          icon="i-lucide-trash-2"
          :disabled="confirmDisabled"
          :loading="loading"
          @click="emit('confirm')"
        >
          {{ confirmLabel }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
