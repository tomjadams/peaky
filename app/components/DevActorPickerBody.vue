<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { LifecycleActor } from "~/lifecycle/management";
import { useCatalogUserSearch } from "~/composables/catalog/useCatalogUserSearch";
import {
  isConfirmedDevSelection,
  resolveDevActor,
} from "~/composables/auth/dev-actor-selection";

// Dev-only local actor picker (issue #89) — restores the pre-Okta "local
// profile" picker, shown by `ProfileModal.vue` only when `oidcEnabled` is
// false. Owns its own state/data/watcher/handler; `save()`/`canSave` are
// exposed because the parent's footer buttons live in a different named
// `UModal` slot than this component.

// ── Props / Emits ──────────────────────────────────────────────────────────
const props = defineProps<{
  open: boolean;
  currentActor: LifecycleActor;
}>();

const emit = defineEmits<{
  save: [actor: LifecycleActor];
}>();

// ── Reactive state ──────────────────────────────────────────────────────────
const selectedActorId = ref(props.currentActor.id);
const isDevAdminEnabled = ref(props.currentActor.roles.includes("admin"));

const { allUsers, loading, ensureLoaded } = useCatalogUserSearch({
  eager: false,
});

// ── Computed ─────────────────────────────────────────────────────────────
const hasConfirmedSelection = computed(() =>
  isConfirmedDevSelection(
    selectedActorId.value,
    props.currentActor.id,
    allUsers.value
  )
);

// Also gated on `loading`: saving before the catalog mirror's first load
// settles would resolve names against an empty candidate list.
const canSave = computed(() => hasConfirmedSelection.value && !loading.value);

// ── Watchers ─────────────────────────────────────────────────────────────
watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return;
    void ensureLoaded();
    selectedActorId.value = props.currentActor.id;
    isDevAdminEnabled.value = props.currentActor.roles.includes("admin");
  }
);

// ── Handlers ─────────────────────────────────────────────────────────────
function save(): void {
  if (!canSave.value) return;
  emit(
    "save",
    resolveDevActor({
      selectedId: selectedActorId.value,
      currentActor: props.currentActor,
      candidates: allUsers.value,
      isAdmin: isDevAdminEnabled.value,
    })
  );
}

defineExpose({ canSave, save });
</script>

<template>
  <div class="space-y-5 p-1">
    <div>
      <h3 class="text-default text-base font-semibold">Local dev profile</h3>
      <p class="text-muted mt-1 text-sm">
        OIDC is not configured in this environment. Choose who you are in this
        browser.
      </p>
    </div>

    <div class="border-default rounded-lg border p-4">
      <p class="text-default text-sm font-medium">Current actor</p>
      <p class="text-muted mt-1 text-sm">
        {{ currentActor.name }} · {{ currentActor.id }}
      </p>
    </div>

    <div class="space-y-2">
      <label class="text-default text-sm font-medium">User</label>
      <UserAutocomplete
        v-model="selectedActorId"
        placeholder="Search name or user ID"
      />
      <p v-if="!hasConfirmedSelection" class="text-warning text-[13px]">
        Pick a user from the list to confirm — typed text alone isn't saved.
      </p>
    </div>

    <label
      class="hover:bg-muted flex cursor-pointer items-start gap-3 rounded-md px-3 py-2 transition-colors duration-150"
    >
      <!-- Default checkbox border is too faint against bg-elevated in dark
           mode — same override DataTable.vue already applies to UCheckbox. -->
      <UCheckbox
        v-model="isDevAdminEnabled"
        :ui="{ base: 'dark:border-slate-400' }"
      />
      <span>
        <span class="text-default block text-sm font-medium">
          Treat this local actor as admin
        </span>
        <span class="text-muted block text-sm">
          Use this only as a temporary workaround until real authentication is
          configured.
        </span>
      </span>
    </label>
  </div>
</template>
