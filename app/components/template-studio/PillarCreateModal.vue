<template>
  <UModal
    v-model:open="isOpen"
    title="Create new pillar"
    :ui="{ content: 'max-w-lg' }"
  >
    <template #body>
      <div class="space-y-6">
        <!-- How Pillars Work Collapsible -->
        <UCollapsible v-model:open="isHelpExpanded">
          <template #default="{ open: isExpanded }">
            <button
              type="button"
              class="bg-muted text-default hover:bg-accented/60 flex w-full items-center justify-between rounded-lg px-4 py-3 text-left text-sm font-semibold transition-colors dark:hover:bg-slate-700"
            >
              <span class="flex items-center gap-2">
                <Icon name="lucide:info" class="h-4 w-4 text-violet-500" />
                How pillars work
              </span>
              <Icon
                :name="isExpanded ? 'lucide:chevron-up' : 'lucide:chevron-down'"
                class="text-dimmed h-4 w-4"
              />
            </button>
          </template>
          <template #content>
            <div class="px-4 pt-2 pb-4">
              <p class="text-muted mb-4 text-sm">
                Think of pillars as categories for your questions, building on
                top of each other. You can change the order as you see fit
                later.
              </p>

              <!-- Layered progression visualization -->
              <div class="bg-muted flex items-center gap-3 rounded-lg p-4">
                <!-- Left: Progression indicator -->
                <div
                  class="text-muted flex flex-col items-center gap-1 text-[13px] font-medium"
                >
                  <Icon name="lucide:arrow-up" class="h-3 w-3" />
                  <span
                    class="writing-mode-vertical rotate-180 whitespace-nowrap"
                    >Value</span
                  >
                </div>

                <!-- Right: Stacked layers -->
                <div class="flex flex-1 flex-col gap-1.5">
                  <!-- Clarity - highest level -->
                  <div
                    class="flex items-center gap-2 rounded-md bg-emerald-200/90 px-3 py-1.5 dark:bg-emerald-900/40"
                  >
                    <span class="h-2 w-2 rounded-full bg-emerald-600" />
                    <span
                      class="text-[13px] font-semibold text-emerald-900 dark:text-emerald-300"
                      >Clarity</span
                    >
                    <span
                      class="ml-auto flex items-center gap-1 text-[13px] text-emerald-800 dark:text-emerald-400"
                    >
                      <Icon name="lucide:target" class="h-3 w-3" />
                      Customer focus, roadmap, etc.
                    </span>
                  </div>
                  <!-- Reliability -->
                  <div
                    class="flex items-center gap-2 rounded-md bg-blue-200/90 px-3 py-1.5 dark:bg-blue-900/40"
                  >
                    <span class="h-2 w-2 rounded-full bg-blue-600" />
                    <span
                      class="text-[13px] font-semibold text-blue-900 dark:text-blue-300"
                      >Reliability</span
                    >
                    <span
                      class="ml-auto flex items-center gap-1 text-[13px] text-blue-800 dark:text-blue-400"
                    >
                      <Icon name="lucide:activity" class="h-3 w-3" />
                      Resilience, automated testing, etc.
                    </span>
                  </div>
                  <!-- Security -->
                  <div
                    class="flex items-center gap-2 rounded-md bg-amber-200/90 px-3 py-1.5 dark:bg-amber-900/40"
                  >
                    <span class="h-2 w-2 rounded-full bg-amber-600" />
                    <span
                      class="text-[13px] font-semibold text-amber-900 dark:text-amber-300"
                      >Security</span
                    >
                    <span
                      class="ml-auto flex items-center gap-1 text-[13px] text-amber-800 dark:text-amber-400"
                    >
                      <Icon name="lucide:shield" class="h-3 w-3" />
                      Application security, data protection, etc.
                    </span>
                  </div>
                  <!-- Operations - foundation -->
                  <div
                    class="flex items-center gap-2 rounded-md bg-slate-300/90 px-3 py-1.5 dark:bg-slate-700/60"
                  >
                    <span class="h-2 w-2 rounded-full bg-slate-600" />
                    <span
                      class="text-[13px] font-semibold text-slate-900 dark:text-slate-200"
                      >Operations</span
                    >
                    <span
                      class="ml-auto flex items-center gap-1 text-[13px] text-slate-700 dark:text-slate-300"
                    >
                      <Icon name="lucide:layers" class="h-3 w-3" />
                      Processes, observability, etc.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </UCollapsible>

        <!-- Form Fields -->
        <div class="space-y-5">
          <UFormField label="Pillar name" name="name" required>
            <UInput
              v-model="name"
              placeholder="e.g., Security, Reliability, Operations"
              size="xl"
              autofocus
              style="width: 100%"
              class="w-full"
              :ui="{ base: 'text-base !w-full', root: '!w-full' }"
              @keydown.enter="handleCreate"
            />
          </UFormField>

          <UFormField
            label="Description"
            name="description"
            hint="Optional - shows under pillar name in the editor"
          >
            <UTextarea
              v-model="description"
              :rows="5"
              placeholder="Brief description of what this pillar covers..."
              autoresize
              style="width: 100%"
              class="w-full"
              :ui="{
                base: 'min-h-[120px] text-base px-4 py-3 !w-full',
                root: '!w-full',
              }"
            />
          </UFormField>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-3">
        <UButton variant="outline" color="neutral" @click="handleCancel">
          Cancel
        </UButton>
        <UButton :disabled="!name.trim()" @click="handleCreate">
          Create pillar
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { useLocalStorage } from "@vueuse/core";

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  create: [name: string, slug: string, description: string];
}>();

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit("update:open", value),
});

const name = ref("");
const description = ref("");

// Persist help section collapse state
const isHelpExpanded = useLocalStorage("peaky:pillar-diagram-collapsed", true);

const slugify = (text: string) => {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
};

const handleCancel = () => {
  isOpen.value = false;
  resetForm();
};

const handleCreate = () => {
  if (name.value.trim()) {
    emit(
      "create",
      name.value.trim(),
      slugify(name.value.trim()),
      description.value.trim()
    );
    isOpen.value = false;
    resetForm();
  }
};

const resetForm = () => {
  name.value = "";
  description.value = "";
};

// Reset form when modal opens
watch(isOpen, (open) => {
  if (open) {
    resetForm();
  }
});
</script>

<style scoped>
.writing-mode-vertical {
  writing-mode: vertical-rl;
}
</style>
