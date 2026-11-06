<template>
  <div class="relative">
    <UInput
      :id="inputId"
      v-model="inputValue"
      :size="size"
      icon="i-lucide-search"
      :placeholder="placeholder"
      :loading="loading"
      @focus="handleFocus"
      @blur="handleBlur"
      @keydown.enter.prevent="handleEnter"
      @keydown.down.prevent="handleArrowDown"
      @keydown.up.prevent="handleArrowUp"
    />

    <div
      v-if="
        showResults &&
        (results.length > 0 || (inputValue.length >= 2 && !loading))
      "
      class="border-default bg-default absolute z-50 mt-1 w-full overflow-hidden rounded-lg border shadow-lg"
    >
      <button
        v-for="(user, index) in results"
        :key="user.id"
        type="button"
        :class="[
          'flex w-full flex-col px-3 py-2 text-left',
          index === highlightedIndex ? 'bg-elevated' : 'hover:bg-elevated',
        ]"
        @mousedown.prevent="selectUser(user)"
        @mouseenter="highlightedIndex = index"
      >
        <span class="text-default text-sm font-medium">{{
          user.displayName
        }}</span>
        <span class="text-dimmed text-xs">{{ getUserMetaLabel(user) }}</span>
      </button>

      <div
        v-if="results.length === 0 && inputValue.length >= 2 && !loading"
        class="text-muted px-3 py-3 text-center text-sm"
      >
        No users found for "{{ inputValue }}"
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  useCatalogUserSearch,
  type CatalogUser,
} from "~/composables/catalog/useCatalogUserSearch";

const props = withDefaults(
  defineProps<{
    modelValue: string;
    inputId?: string;
    placeholder?: string;
    size?: "sm" | "md" | "lg" | "xl";
  }>(),
  {
    inputId: undefined,
    placeholder: "Search name or user ID",
    size: "lg",
  }
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const { results, loading, search, clear, ensureLoaded } =
  useCatalogUserSearch();

const inputValue = ref(props.modelValue);
const showResults = ref(false);
const highlightedIndex = ref(-1);
const selectingFromResults = ref(false);

watch(
  () => props.modelValue,
  (val) => {
    if (val !== inputValue.value) {
      inputValue.value = val;
    }
  }
);

watch(inputValue, (val) => {
  emit("update:modelValue", val.trim());
  highlightedIndex.value = -1;
  if (selectingFromResults.value) {
    selectingFromResults.value = false;
    return;
  }
  if (val.trim().length >= 2) {
    search(val);
    showResults.value = true;
  } else {
    clear();
  }
});

const handleFocus = () => {
  showResults.value = true;
  void ensureLoaded();
};

const selectUser = (user: CatalogUser) => {
  selectingFromResults.value = true;
  inputValue.value = user.id;
  emit("update:modelValue", user.id);
  showResults.value = false;
  highlightedIndex.value = -1;
  clear();
};

const getUserMetaLabel = (user: CatalogUser) => {
  const displayAlias = user.displayName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ".");
  return `${user.id} · ${displayAlias}`;
};

const handleEnter = () => {
  if (
    highlightedIndex.value >= 0 &&
    highlightedIndex.value < results.value.length
  ) {
    selectUser(results.value[highlightedIndex.value]!);
  } else if (inputValue.value.trim()) {
    emit("update:modelValue", inputValue.value.trim());
    showResults.value = false;
    clear();
  }
};

const handleArrowDown = () => {
  if (results.value.length > 0) {
    highlightedIndex.value = Math.min(
      highlightedIndex.value + 1,
      results.value.length - 1
    );
  }
};

const handleArrowUp = () => {
  if (results.value.length > 0) {
    highlightedIndex.value = Math.max(highlightedIndex.value - 1, 0);
  }
};

const handleBlur = () => {
  setTimeout(() => {
    showResults.value = false;
    highlightedIndex.value = -1;
  }, 150);
};
</script>
