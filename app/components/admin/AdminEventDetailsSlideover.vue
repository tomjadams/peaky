<script setup lang="ts">
import type { AdminEventRecord } from "~/admin/events";
import {
  formatCategoryLabel,
  formatEventTimeFull,
  formatSourceLabel,
  getCategoryColor,
  getStatusColor,
} from "~/admin/formatters";
import { useCurrentActor } from "~/composables/auth/useCurrentActor";
import { buildLifecycleActorHeaders } from "~/lifecycle/management";

interface Props {
  details: string;
  event: AdminEventRecord | null;
  open: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  redacted: [eventId: string];
}>();

const { actor } = useCurrentActor();
const isAdmin = computed(() => actor.value.roles.includes("admin"));
const isRedacting = ref(false);
const redactError = ref<string | null>(null);

async function requestErasure() {
  if (!props.event) return;
  isRedacting.value = true;
  redactError.value = null;
  try {
    await $fetch(`/api/admin/events/${props.event.id}/redact`, {
      method: "POST",
      headers: buildLifecycleActorHeaders(actor.value),
    });
    emit("redacted", props.event.id);
    emit("update:open", false);
  } catch {
    redactError.value = "Erasure request failed. Please try again.";
  } finally {
    isRedacting.value = false;
  }
}
</script>

<template>
  <Teleport to="body">
    <USlideover
      :open="props.open"
      title="Event details"
      side="right"
      :ui="{ content: 'max-w-2xl z-[60]', overlay: 'z-[60]' }"
      @update:open="emit('update:open', $event)"
    >
      <template #body>
        <div v-if="props.event" class="space-y-6 p-1">
          <UAlert
            v-if="props.event.piiRedactedAt"
            color="neutral"
            variant="subtle"
            icon="i-lucide-shield-check"
            title="GDPR erasure applied"
            :description="`Personally identifiable fields were redacted on ${formatEventTimeFull(props.event.piiRedactedAt)}.`"
          />

          <section
            class="border-default bg-elevated space-y-3 rounded-lg border p-4"
          >
            <div class="flex flex-wrap items-center gap-2">
              <UBadge
                :color="getCategoryColor(props.event.category)"
                variant="subtle"
                size="md"
              >
                {{ formatCategoryLabel(props.event.category) }}
              </UBadge>
              <UBadge
                :color="getStatusColor(props.event.status)"
                variant="subtle"
                size="md"
              >
                {{ props.event.status }}
              </UBadge>
              <UBadge
                v-if="props.event.piiRedactedAt"
                color="neutral"
                variant="subtle"
                size="md"
              >
                PII redacted
              </UBadge>
            </div>

            <div>
              <h3 class="text-default text-lg font-semibold">
                {{ props.event.actionLabel }}
              </h3>
              <p class="text-muted mt-1 text-sm">
                {{ props.event.summary }}
              </p>
            </div>
          </section>

          <section
            class="border-default bg-elevated grid gap-4 rounded-lg border p-4 md:grid-cols-2"
          >
            <div>
              <p class="text-muted text-sm font-semibold">Resource</p>
              <p class="text-default mt-1 font-medium">
                {{ props.event.subjectName }}
              </p>
              <p class="text-muted text-sm">
                {{ props.event.subjectTypeLabel }} ·
                {{ props.event.subjectId }}
              </p>
            </div>

            <div>
              <p class="text-muted text-sm font-semibold">Actor</p>
              <p class="text-default mt-1 font-medium">
                {{ props.event.actorName }}
              </p>
              <p class="text-muted text-sm">
                {{ props.event.actorId }} · {{ props.event.actorType }}
              </p>
            </div>

            <div>
              <p class="text-muted text-sm font-semibold">Source</p>
              <p class="text-default mt-1 font-medium">
                {{ formatSourceLabel(props.event.source) }}
              </p>
            </div>

            <div>
              <p class="text-muted text-sm font-semibold">Occurred</p>
              <p class="text-default mt-1 font-medium">
                {{ formatEventTimeFull(props.event.time) }}
              </p>
            </div>
          </section>

          <section
            v-if="props.event.actorRoles.length > 0"
            class="border-default bg-elevated rounded-lg border p-4"
          >
            <p class="text-muted text-sm font-semibold">Actor roles</p>
            <div class="mt-3 flex flex-wrap gap-2">
              <UBadge
                v-for="role in props.event.actorRoles"
                :key="role"
                color="neutral"
                variant="subtle"
                size="md"
              >
                {{ role }}
              </UBadge>
            </div>
          </section>

          <section class="border-default bg-elevated rounded-lg border p-4">
            <div class="flex items-center justify-between gap-3">
              <p class="text-muted text-sm font-semibold">Raw details</p>
              <UButton
                v-if="props.event.subjectUrl"
                color="neutral"
                variant="ghost"
                icon="i-lucide-arrow-up-right"
                @click="navigateTo(props.event.subjectUrl)"
              >
                Open resource
              </UButton>
            </div>
            <pre
              class="bg-muted text-default mt-3 overflow-x-auto rounded-lg p-4 text-xs leading-6"
            ><code>{{ props.details }}</code></pre>
          </section>

          <section
            v-if="isAdmin && !props.event.piiRedactedAt"
            class="border-default rounded-lg border p-4"
          >
            <p class="text-muted text-sm font-semibold">
              GDPR / Right to erasure
            </p>
            <p class="text-muted mt-2 text-sm">
              Redacts the actor's name and any stored free-text content from
              this event. The event record itself is preserved for audit
              integrity.
            </p>
            <UAlert
              v-if="redactError"
              color="error"
              variant="subtle"
              class="mt-3"
              :title="redactError"
            />
            <UButton
              class="mt-3"
              color="neutral"
              variant="outline"
              icon="i-lucide-shield"
              size="sm"
              :loading="isRedacting"
              @click="requestErasure"
            >
              Apply erasure
            </UButton>
          </section>
        </div>
      </template>
    </USlideover>
  </Teleport>
</template>
