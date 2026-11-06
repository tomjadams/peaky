<template>
  <div class="border-default bg-default border-b">
    <div class="flex min-w-0 items-center gap-3 px-4 py-2">
      <UTooltip text="Drag pillars to reorder them">
        <div
          class="border-default flex shrink-0 items-center gap-1.5 border-r pr-3"
        >
          <Icon name="lucide:layers" class="text-primary h-4 w-4" />
          <span class="text-muted text-sm font-semibold">Pillars</span>
        </div>
      </UTooltip>

      <!-- Pillar Tabs -->
      <div
        ref="sortableRef"
        data-pillar-list
        class="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto"
      >
        <div
          v-for="pillar in pillars"
          :key="pillar.slug"
          class="group relative flex shrink-0 items-center"
          :data-pillar-slug="pillar.slug"
        >
          <div
            role="button"
            tabindex="0"
            class="focus:ring-primary/50 flex max-w-64 cursor-grab items-center gap-2 border-b-2 py-2 pr-9 pl-3 text-[15px] transition-all focus:ring-2 focus:outline-none"
            :class="[
              activePillarSlug === pillar.slug
                ? 'border-inverted text-highlighted font-bold'
                : 'text-muted hover:text-default border-transparent font-semibold',
            ]"
            @click="$emit('select', pillar.slug)"
            @keydown.enter="$emit('select', pillar.slug)"
            @keydown.space.prevent="$emit('select', pillar.slug)"
          >
            <!-- Drag Handle (always visible) -->
            <span v-if="!readonly" class="text-dimmed">
              <Icon name="lucide:grip-vertical" class="h-3 w-3" />
            </span>
            <span
              data-pillar-name
              class="min-w-0 truncate"
              :title="pillar.name"
            >
              {{ pillar.name }}
            </span>
            <span
              class="shrink-0 text-[13px] font-semibold tabular-nums transition-colors"
              :class="
                activePillarSlug === pillar.slug
                  ? 'text-primary'
                  : 'text-dimmed'
              "
            >
              {{ pillar.questions.length }}
            </span>
            <!-- Delete button (hidden by default, revealed on hover) -->
            <button
              v-if="!readonly"
              type="button"
              class="text-dimmed hover:text-error absolute right-1 rounded p-1 opacity-0 transition-[opacity,color,background-color] group-hover:opacity-100 focus-visible:opacity-100"
              title="Delete pillar"
              @click.stop="pendingDeleteSlug = pillar.slug"
            >
              <Icon name="lucide:trash-2" class="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      <!-- Add Pillar -->
      <div class="border-default flex shrink-0 items-center border-l pl-3">
        <UTooltip :text="readonly ? readonlyReason : 'Add a pillar'">
          <span class="inline-flex">
            <button
              type="button"
              data-add-pillar-btn
              :disabled="readonly"
              class="text-primary hover:text-primary/80 flex items-center gap-1 rounded-md px-2 py-1.5 text-[15px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45"
              @click="showCreateModal = true"
            >
              <Icon name="lucide:plus" class="h-4 w-4" />
              <span class="hidden sm:inline">Add pillar</span>
            </button>
          </span>
        </UTooltip>
      </div>
    </div>

    <!-- Pillar Create Modal -->
    <TemplateStudioPillarCreateModal
      v-model:open="showCreateModal"
      @create="handlePillarCreate"
    />

    <UModal
      :open="pendingDeletePillar !== null"
      title="Delete pillar"
      :ui="{ content: 'max-w-md' }"
      @update:open="!$event && (pendingDeleteSlug = null)"
    >
      <template #body>
        <p class="text-muted text-sm leading-relaxed">
          Delete
          <span class="text-default font-semibold">{{
            pendingDeletePillar?.name
          }}</span>
          and its {{ pendingDeletePillar?.questions.length ?? 0 }} question{{
            pendingDeletePillar?.questions.length === 1 ? "" : "s"
          }}? This cannot be undone.
        </p>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            @click="pendingDeleteSlug = null"
          >
            Cancel
          </UButton>
          <UButton color="error" @click="confirmPillarDelete">
            Delete pillar
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { TemplatePillar } from "~/models";
import Sortable, { type SortableEvent } from "sortablejs";

const props = withDefaults(
  defineProps<{
    pillars: TemplatePillar[];
    activePillarSlug: string | null;
    readonly?: boolean;
    readonlyReason?: string;
  }>(),
  {
    readonly: false,
    readonlyReason: "You do not have permission to edit this template.",
  }
);

const emit = defineEmits<{
  select: [slug: string];
  add: [name: string, slug: string, description: string];
  delete: [slug: string];
  reorder: [fromIndex: number, toIndex: number];
}>();

const pendingDeleteSlug = ref<string | null>(null);
const pendingDeletePillar = computed(
  () =>
    props.pillars.find((pillar) => pillar.slug === pendingDeleteSlug.value) ??
    null
);
const showCreateModal = ref(false);
const sortableRef = ref<HTMLElement | null>(null);

// Expose method to open modal from parent
const openCreateModal = () => {
  if (props.readonly) return;
  showCreateModal.value = true;
};

defineExpose({ openCreateModal });

const sortable = shallowRef<Sortable | null>(null);

const destroySortable = () => {
  sortable.value?.destroy();
  sortable.value = null;
};

const initializeSortable = () => {
  if (!sortableRef.value || props.readonly || sortable.value) return;
  sortable.value = Sortable.create(sortableRef.value, {
    animation: 200,
    ghostClass: "sortable-ghost",
    dragClass: "sortable-drag",
    chosenClass: "sortable-chosen",
    onEnd: (evt: SortableEvent) => {
      if (
        evt.oldIndex !== undefined &&
        evt.newIndex !== undefined &&
        evt.oldIndex !== evt.newIndex
      ) {
        emit("reorder", evt.oldIndex, evt.newIndex);
      }
    },
  });
};

watch(
  () => props.readonly,
  async () => {
    destroySortable();
    await nextTick();
    initializeSortable();
  },
  { immediate: true, flush: "post" }
);

onUnmounted(destroySortable);

const handlePillarCreate = (
  name: string,
  slug: string,
  description: string
) => {
  emit("add", name, slug, description);
};

const confirmPillarDelete = () => {
  if (!pendingDeleteSlug.value) return;
  emit("delete", pendingDeleteSlug.value);
  pendingDeleteSlug.value = null;
};
</script>

<style scoped>
[draggable="true"] {
  cursor: grab;
}

[draggable="true"]:active {
  cursor: grabbing;
}

.sortable-ghost {
  opacity: 0.4;
  border: none !important;
  box-shadow: none !important;
}

/* Disable focus/hover/active styles during drag and chosen states */
.sortable-drag [role="button"],
.sortable-drag [role="button"]:hover,
.sortable-drag [role="button"]:focus,
.sortable-drag [role="button"]:active,
.sortable-chosen [role="button"],
.sortable-chosen [role="button"]:hover,
.sortable-chosen [role="button"]:focus,
.sortable-chosen [role="button"]:active {
  background: transparent !important;
  box-shadow: none !important;
  outline: none !important;
  /* Prevent focus ring from showing */
  --tw-ring-shadow: none !important;
}
</style>
