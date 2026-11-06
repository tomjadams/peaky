<template>
  <div class="search-input">
    <UInput
      v-model="searchQuery"
      :placeholder="placeholder"
      icon="i-lucide-search"
      size="md"
      :ui="{
        root: 'w-full',
        base: 'bg-muted text-[15px] ring-0 hover:ring-0 focus:bg-default focus:ring-2 focus:ring-inset focus:ring-primary dark:bg-white/[0.04] dark:focus:bg-transparent',
      }"
    >
      <template v-if="searchQuery" #trailing>
        <UButton
          color="neutral"
          variant="link"
          size="xs"
          icon="i-lucide-x"
          aria-label="Clear search"
          @click="clearSearch"
        />
      </template>
    </UInput>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    placeholder?: string;
  }>(),
  { placeholder: "Search..." }
);

const searchQuery = defineModel<string>({ default: "" });

const clearSearch = () => {
  searchQuery.value = "";
};
</script>
