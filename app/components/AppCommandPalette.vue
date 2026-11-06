<template>
  <UModal
    :open="isOpen"
    :ui="{ content: 'max-w-3xl' }"
    @update:open="!$event && close()"
  >
    <template #content>
      <div
        class="bg-default command-palette flex flex-col overflow-hidden rounded-lg"
        @keydown="handleKeydown"
      >
        <!-- Search -->
        <div class="command-palette__header border-default border-b p-4">
          <UInput
            ref="inputRef"
            v-model="query"
            icon="i-lucide-sparkles"
            placeholder="Search commands, apps, actions..."
            aria-label="Search commands"
            autocomplete="off"
            size="xl"
            :ui="{
              root: 'w-full',
              base: 'bg-muted ring-0 hover:ring-0 focus:bg-default focus:ring-2 focus:ring-inset focus:ring-primary dark:bg-white/[0.04] dark:focus:bg-transparent',
            }"
          >
            <template #trailing>
              <div v-if="isLoading">
                <Icon
                  name="lucide:loader-2"
                  class="text-primary h-5 w-5 animate-spin"
                />
              </div>
              <kbd
                v-else
                class="border-default bg-muted text-muted rounded-md border px-2 py-0.5 text-[13px] font-medium"
              >
                esc
              </kbd>
            </template>
          </UInput>
        </div>

        <!-- Results -->
        <div
          class="command-palette__results max-h-[28rem] overflow-x-hidden overflow-y-auto"
          role="listbox"
          aria-label="Command results"
        >
          <template v-if="hasResults">
            <div
              v-for="[group, cmds] in groupedCommands"
              :key="group"
              class="command-palette__group"
            >
              <div
                class="command-palette__group-header border-default bg-default text-muted sticky top-0 z-10 border-b px-5 py-2.5 text-sm font-semibold"
              >
                {{ group }}
              </div>
              <ul class="px-3 py-2">
                <li
                  v-for="(cmd, index) in cmds"
                  :key="cmd.id"
                  class="cursor-pointer rounded-lg"
                  :class="{
                    'opacity-50': cmd.disabled,
                  }"
                  role="option"
                  :aria-selected="isSelected(group, index)"
                  :aria-disabled="cmd.disabled"
                  @click="!cmd.disabled && executeCommand(cmd)"
                  @mouseenter="setSelectedIndex(getGlobalIndex(group, index))"
                >
                  <div
                    class="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors duration-150"
                    :class="
                      isSelected(group, index)
                        ? 'bg-[#EAF3FA] dark:bg-sky-400/10'
                        : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.04]'
                    "
                  >
                    <div
                      v-if="cmd.icon"
                      class="bg-muted flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
                    >
                      <Icon
                        :name="cmd.icon"
                        class="text-default h-4 w-4"
                        aria-hidden="true"
                      />
                    </div>
                    <div v-else class="bg-muted h-8 w-8 shrink-0 rounded-md" />
                    <span
                      class="text-highlighted flex-1 truncate text-[15px] font-medium"
                    >
                      {{ cmd.title }}
                    </span>
                    <kbd
                      v-if="cmd.shortcut"
                      class="border-default bg-muted text-muted rounded-md border px-2 py-0.5 text-[13px] font-medium"
                    >
                      {{ cmd.shortcut }}
                    </kbd>
                    <Icon
                      name="lucide:arrow-right"
                      class="text-dimmed h-5 w-5 transition-opacity"
                      :class="{
                        'opacity-100': isSelected(group, index),
                        'opacity-0': !isSelected(group, index),
                      }"
                      aria-hidden="true"
                    />
                  </div>
                </li>
              </ul>
            </div>
          </template>

          <!-- Empty states -->
          <div v-else-if="query && !isLoading" class="px-6 py-16 text-center">
            <div
              class="bg-muted mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
            >
              <Icon name="lucide:search-x" class="text-muted h-7 w-7" />
            </div>
            <p class="text-highlighted text-[15px] font-semibold">
              No results found
            </p>
            <p class="text-muted mt-1 text-sm">Try different keywords</p>
          </div>

          <div v-else-if="!query && !hasResults" class="px-6 py-16 text-center">
            <div
              class="bg-primary/10 mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
            >
              <Icon name="lucide:sparkles" class="text-primary h-7 w-7" />
            </div>
            <p class="text-highlighted text-[15px] font-semibold">
              Quick actions
            </p>
            <p class="text-muted mt-1 text-sm">
              Search for apps, navigate pages, or run commands
            </p>
          </div>
        </div>

        <!-- Footer -->
        <div
          class="command-palette__footer border-default bg-default text-muted flex items-center justify-between rounded-b-lg border-t px-5 py-3 text-[13px]"
        >
          <div class="flex items-center gap-5">
            <span class="flex items-center gap-2">
              <kbd
                class="border-default bg-muted rounded-md border px-2 py-0.5 font-medium"
                >↑</kbd
              >
              <kbd
                class="border-default bg-muted rounded-md border px-2 py-0.5 font-medium"
                >↓</kbd
              >
              <span class="text-dimmed">navigate</span>
            </span>
            <span class="flex items-center gap-2">
              <kbd
                class="border-default bg-muted rounded-md border px-2 py-0.5 font-medium"
                >↵</kbd
              >
              <span class="text-dimmed">select</span>
            </span>
          </div>
          <span class="flex items-center gap-2">
            <kbd
              class="border-default bg-muted rounded-md border px-2 py-0.5 font-medium"
              >esc</kbd
            >
            <span class="text-dimmed">close</span>
          </span>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { onKeyStroke } from "@vueuse/core";
import {
  useCommandPalette,
  type Command,
} from "~/composables/nav/useCommandPalette";

const {
  isOpen,
  query,
  close,
  groupedCommands,
  executeCommand,
  isLoading,
  filteredCommands,
} = useCommandPalette();

const inputRef = useTemplateRef<{ $el: HTMLElement }>("inputRef");
const selectedIndex = ref(0);

const hasResults = computed(() => filteredCommands.value.length > 0);

const flatCommands = computed(() => {
  const flat: { group: string; command: Command; index: number }[] = [];
  let i = 0;
  for (const [group, cmds] of groupedCommands.value) {
    for (const cmd of cmds) {
      flat.push({ group, command: cmd, index: i++ });
    }
  }
  return flat;
});

const getGlobalIndex = (group: string, localIndex: number): number => {
  let offset = 0;
  for (const [g, cmds] of groupedCommands.value) {
    if (g === group) return offset + localIndex;
    offset += cmds.length;
  }
  return 0;
};

const isSelected = (group: string, localIndex: number): boolean => {
  return getGlobalIndex(group, localIndex) === selectedIndex.value;
};

const setSelectedIndex = (index: number) => {
  selectedIndex.value = index;
};

watch(isOpen, (open) => {
  if (open) {
    selectedIndex.value = 0;
    nextTick(() => {
      const input = inputRef.value?.$el?.querySelector(
        "input"
      ) as HTMLInputElement;
      input?.focus();
    });
  }
});

watch(filteredCommands, () => {
  selectedIndex.value = 0;
});

// Global escape handler active only while modal is open
onKeyStroke("Escape", (e: KeyboardEvent) => {
  if (isOpen.value) {
    e.preventDefault();
    close();
  }
});

const handleKeydown = (e: KeyboardEvent) => {
  switch (e.key) {
    case "ArrowDown":
      e.preventDefault();
      if (flatCommands.value.length > 0) {
        selectedIndex.value =
          (selectedIndex.value + 1) % flatCommands.value.length;
      }
      break;
    case "ArrowUp":
      e.preventDefault();
      if (flatCommands.value.length > 0) {
        selectedIndex.value =
          (selectedIndex.value - 1 + flatCommands.value.length) %
          flatCommands.value.length;
      }
      break;
    case "Enter": {
      e.preventDefault();
      const selected = flatCommands.value[selectedIndex.value];
      if (selected && !selected.command.disabled) {
        executeCommand(selected.command);
      }
      break;
    }
    case "Tab":
      e.preventDefault();
      break;
  }
};
</script>
