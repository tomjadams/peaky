<template>
  <UModal
    :open="isOpen"
    :ui="{ content: 'max-w-lg' }"
    @update:open="!$event && $emit('close')"
  >
    <template #content>
      <div>
        <!-- Header -->
        <div
          class="border-default flex items-center justify-between border-b p-4 dark:border-slate-700"
        >
          <h3
            id="share-modal-title"
            class="text-highlighted text-lg font-semibold"
          >
            Share template
          </h3>
          <button
            type="button"
            class="text-dimmed hover:bg-muted hover:text-default rounded-lg p-1.5 transition-colors dark:hover:bg-slate-700"
            aria-label="Close"
            @click="$emit('close')"
          >
            <Icon name="lucide:x" class="h-5 w-5" />
          </button>
        </div>

        <!-- Content -->
        <div class="space-y-6 p-6">
          <!-- Copy Link -->
          <UFormField label="Share Link">
            <div class="flex gap-2">
              <UInput
                :model-value="shareLink"
                type="text"
                readonly
                class="flex-1"
              />
              <UButton
                variant="outline"
                color="neutral"
                :icon="linkCopied ? 'i-lucide-check' : 'i-lucide-copy'"
                @click="copyLink"
              >
                {{ linkCopied ? "Copied!" : "Copy" }}
              </UButton>
            </div>
          </UFormField>

          <!-- Add Collaborator -->
          <UFormField label="Add People" :error="emailError">
            <div class="flex gap-2">
              <UInput
                v-model="newCollaboratorEmail"
                type="email"
                placeholder="Enter email address"
                class="flex-1"
                :color="emailError ? 'error' : 'primary'"
                @keydown.enter="addCollaborator"
              />
              <USelect
                v-model="newCollaboratorPermission"
                :items="[
                  { label: 'Can view', value: 'view' },
                  { label: 'Can edit', value: 'edit' },
                ]"
              />
              <UButton
                :disabled="!newCollaboratorEmail"
                @click="addCollaborator"
              >
                Add
              </UButton>
            </div>
          </UFormField>

          <!-- Collaborators List -->
          <div v-if="collaborators.length > 0" class="space-y-2">
            <span class="text-default block text-sm font-medium">
              People with access
            </span>
            <ul
              class="divide-default border-default divide-y rounded-lg border dark:divide-slate-700 dark:border-slate-700"
            >
              <li
                v-for="collaborator in collaborators"
                :key="collaborator.email"
                class="flex items-center justify-between p-3"
              >
                <div class="flex items-center gap-3">
                  <div
                    class="bg-accented text-muted flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold dark:bg-slate-700 dark:text-slate-300"
                  >
                    {{ collaborator.email.charAt(0).toUpperCase() }}
                  </div>
                  <div>
                    <p class="text-highlighted text-sm font-semibold">
                      {{ collaborator.email }}
                    </p>
                    <p class="text-muted text-[13px]">
                      {{
                        collaborator.permission === "edit"
                          ? "Can edit"
                          : "Can view"
                      }}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  class="text-dimmed hover:text-red-500"
                  aria-label="Remove collaborator"
                  @click="removeCollaborator(collaborator.email)"
                >
                  <Icon name="lucide:x" class="h-4 w-4" />
                </button>
              </li>
            </ul>
          </div>
        </div>

        <!-- Footer -->
        <div
          class="border-default flex justify-end border-t p-4 dark:border-slate-700"
        >
          <button
            type="button"
            class="text-muted hover:bg-muted rounded-lg px-4 py-2 text-sm font-medium dark:hover:bg-slate-700"
            @click="$emit('close')"
          >
            Done
          </button>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
interface Collaborator {
  email: string;
  permission: "view" | "edit";
}

const props = defineProps<{
  isOpen: boolean;
  templateId: string;
}>();

defineEmits<{
  close: [];
}>();

const newCollaboratorEmail = ref("");
const newCollaboratorPermission = ref<"view" | "edit">("view");
const linkCopied = ref(false);
const emailError = ref("");
const collaborators = ref<Collaborator[]>([]);

const shareLink = computed(() => {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/templates/${props.templateId}/edit`;
  }
  return `/templates/${props.templateId}/edit`;
});

const copyLink = async () => {
  await navigator.clipboard.writeText(shareLink.value);
  linkCopied.value = true;
  setTimeout(() => {
    linkCopied.value = false;
  }, 2000);
};

const addCollaborator = () => {
  emailError.value = "";
  if (!newCollaboratorEmail.value.trim()) return;

  if (collaborators.value.some((c) => c.email === newCollaboratorEmail.value)) {
    emailError.value = "This person already has access.";
    return;
  }

  collaborators.value.push({
    email: newCollaboratorEmail.value.trim(),
    permission: newCollaboratorPermission.value,
  });

  const toast = useToast();
  toast.add({ title: `Added ${newCollaboratorEmail.value}`, color: "success" });

  newCollaboratorEmail.value = "";
  newCollaboratorPermission.value = "view";
};

const removeCollaborator = (email: string) => {
  collaborators.value = collaborators.value.filter((c) => c.email !== email);
  const toast = useToast();
  toast.add({ title: `Removed ${email}`, color: "neutral" });
};
</script>
