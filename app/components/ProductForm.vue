<!-- eslint-disable vue/no-mutating-props -- form is a reactive() shared with parent, mutations are intentional -->
<template>
  <div class="space-y-8">
    <!-- Identity -->
    <section class="space-y-4">
      <h3 class="text-default flex items-center gap-2 text-sm font-semibold">
        <Icon name="lucide:box" class="h-4 w-4" />
        Identity
      </h3>

      <div class="space-y-1.5">
        <label for="product-name" class="text-default text-sm font-medium">
          Name <span class="text-error">*</span>
        </label>
        <UInput
          id="product-name"
          v-model="form.name"
          size="lg"
          placeholder="e.g., Checkout, Launchpad"
        />
      </div>

      <div class="space-y-2">
        <label class="text-default text-sm font-medium">
          Origin <span class="text-error">*</span>
        </label>
        <!-- Products are internal-only for now — the external products
             registry will bring back a visibility choice when it exists. -->
        <div class="grid gap-3 sm:grid-cols-3">
          <button
            v-for="originInfo in PRODUCT_ORIGIN_INFO"
            :key="originInfo.value"
            type="button"
            :class="[
              'rounded-lg border p-4 text-left transition-all duration-150 active:scale-[0.99]',
              form.origin === originInfo.value
                ? 'border-sky-600 bg-[#EAF3FA] dark:border-sky-400 dark:bg-sky-400/10'
                : 'border-default bg-default hover:border-accented',
            ]"
            @click="form.origin = originInfo.value"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <span class="text-default text-sm font-semibold">{{
                  originInfo.label
                }}</span>
                <p class="text-muted mt-1 text-[13px] leading-relaxed">
                  {{ originInfo.description }}
                </p>
                <p class="text-dimmed mt-1.5 text-[13px]">
                  {{ originInfo.example }}
                </p>
              </div>
              <Icon
                v-if="form.origin === originInfo.value"
                name="lucide:check-circle-2"
                class="mt-0.5 h-5 w-5 shrink-0 text-sky-600 dark:text-sky-400"
              />
            </div>
          </button>
        </div>
      </div>
    </section>

    <!-- Contacts -->
    <section class="space-y-4">
      <h3 class="text-default flex items-center gap-2 text-sm font-semibold">
        <Icon name="lucide:users" class="h-4 w-4" />
        Contacts
      </h3>
      <div class="grid gap-4 sm:grid-cols-2">
        <div class="space-y-1.5">
          <label class="text-default text-sm font-medium"
            >Product Manager <span class="text-error">*</span></label
          >
          <UserAutocomplete
            :model-value="form.productManagerId"
            placeholder="Search by name or user ID..."
            @update:model-value="form.productManagerId = $event"
          />
        </div>
        <div class="space-y-1.5">
          <label class="text-default text-sm font-medium"
            >Engineering Lead</label
          >
          <UserAutocomplete
            :model-value="form.engineeringLeadId"
            placeholder="Search by name or user ID..."
            @update:model-value="form.engineeringLeadId = $event"
          />
        </div>
      </div>
    </section>

    <!-- Teams -->
    <section class="space-y-4">
      <h3 class="text-default flex items-center gap-2 text-sm font-semibold">
        <Icon name="lucide:building-2" class="h-4 w-4" />
        Teams <span class="text-error">*</span>
      </h3>
      <CatalogEntityDropdown
        :all-items="allGroups"
        dedupe-display-names
        :min-query-length="1"
        :result-limit="10"
        :selected-ids="form.teamIds"
        icon="lucide:building-2"
        placeholder="Search teams by name..."
        @add="addTeamId"
        @remove="removeTeamId"
      />
    </section>

    <!-- Applications -->
    <section class="space-y-4">
      <h3 class="text-default flex items-center gap-2 text-sm font-semibold">
        <Icon name="lucide:app-window" class="h-4 w-4" />
        Applications
      </h3>
      <CatalogEntityDropdown
        :all-items="allComponents"
        :preferred-ids="preferredComponentIds"
        :selected-ids="form.componentIds"
        icon="lucide:app-window"
        placeholder="Search applications by name..."
        @add="addComponentId"
        @remove="removeComponentId"
      />
    </section>

    <!-- Links -->
    <section class="space-y-4">
      <h3 class="text-default flex items-center gap-2 text-sm font-semibold">
        <Icon name="lucide:link" class="h-4 w-4" />
        Links
        <span class="text-dimmed text-[13px] font-normal">(optional)</span>
      </h3>
      <div class="space-y-3">
        <div class="space-y-1.5">
          <label class="text-default text-sm font-medium">Roadmap</label>
          <UInput
            v-model="form.roadmapUrl"
            size="lg"
            icon="i-lucide-map"
            placeholder="https://..."
          />
        </div>
        <div class="space-y-1.5">
          <label class="text-default text-sm font-medium">Documentation</label>
          <UInput
            v-model="form.documentationUrl"
            size="lg"
            icon="i-lucide-book-open"
            placeholder="https://..."
          />
        </div>
        <div class="space-y-1.5">
          <label class="text-default text-sm font-medium"
            >Support channel</label
          >
          <UInput
            v-model="form.supportChannel"
            size="lg"
            icon="i-lucide-message-circle"
            placeholder="#help-checkout"
          />
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
/* eslint-disable vue/no-mutating-props -- form is a reactive() shared with parent */
import type { ProductFormState } from "~/composables/products/useProductCreation";
import { PRODUCT_ORIGIN_INFO } from "~/composables/products/useProductFilters";
import { useCatalogGroupSearch } from "~/composables/catalog/useCatalogGroupSearch";
import { useCatalogComponentSearch } from "~/composables/catalog/useCatalogComponentSearch";

const props = defineProps<{ form: ProductFormState }>();

const { allGroups } = useCatalogGroupSearch();
const { allComponents } = useCatalogComponentSearch();

const preferredComponentIds = computed(() => {
  const selectedTeamIds = new Set(props.form.teamIds);

  if (selectedTeamIds.size === 0) {
    return [];
  }

  return allComponents.value
    .filter((component) => {
      return (
        component.ownerGroupId !== undefined &&
        selectedTeamIds.has(component.ownerGroupId)
      );
    })
    .map((component) => component.id);
});

const addTeamId = (id: string) => {
  if (!props.form.teamIds.includes(id)) props.form.teamIds.push(id);
};

const removeTeamId = (id: string) => {
  const idx = props.form.teamIds.indexOf(id);
  if (idx >= 0) props.form.teamIds.splice(idx, 1);
};

const addComponentId = (id: string) => {
  if (!props.form.componentIds.includes(id)) props.form.componentIds.push(id);
};

const removeComponentId = (id: string) => {
  const idx = props.form.componentIds.indexOf(id);
  if (idx >= 0) props.form.componentIds.splice(idx, 1);
};
</script>
