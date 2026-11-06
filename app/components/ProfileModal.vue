<script setup lang="ts">
import type { LifecycleActor } from "~/lifecycle/management";
import { useAuth } from "~/composables/useAuth";
import { useCurrentActor } from "~/composables/auth/useCurrentActor";
import { getInitial } from "~/utils/avatar";
import DevActorPickerBody from "~/components/DevActorPickerBody.vue";
import {
  EntitlementService,
  type Entitlement,
  type EntitlementSnapshot,
} from "~/services/entitlement/EntitlementService";

// Modal-level state is owned by the parent; this component projects it.
// `v-model:open` lets the sidebar keep `isProfileOpen` in its own scope
// (close button reads/writes the model) without forcing us to push the
// prefix `useCurrentActor` state deeper into the tree.
const open = defineModel<boolean>("open", { default: false });

// ── Constants ───────────────────────────────────────────────────────────────
const { oidcEnabled } = useRuntimeConfig().public;

// ── Reactive state / composables ────────────────────────────────────────────
const { user, isLoggedIn, login, logout } = useAuth();
const { actor, isSelfClaimAdmin, setSelfClaimAdmin, setDevActor } =
  useCurrentActor();
const toast = useToast();
const entitlementService = new EntitlementService();
const entitlementSnapshot = ref<EntitlementSnapshot | null>(null);
const entitlementLoading = ref(false);
const entitlementError = ref<string | null>(null);
// Dev-only picker (issue #89): its selection state/data live in
// `DevActorPickerBody.vue`; this just needs a handle to call `save()` and
// read `canSave` from the modal's footer, which is a different named slot
// of the same `UModal`.
const devPickerRef = ref<InstanceType<typeof DevActorPickerBody> | null>(null);

// ── Computed ─────────────────────────────────────────────────────────────
const userInitials = computed(() => getInitial(user.value?.name));

// Effective Admin role, derived from the merged `actor.roles`. The OIDC
// `groups` projection and the local self-claim override are both folded
// into `actor` by `useCurrentActor`, so this is a one-line projection of
// what the composable already computed. The Cedar authz follow-up will
// replace the override key with server-side policy evaluation.
const effectiveIsAdmin = computed(() => actor.value.roles.includes("admin"));

const parsedEntitlements = computed<Record<string, Entitlement> | null>(() => {
  if (!entitlementSnapshot.value) return null;
  try {
    return JSON.parse(entitlementSnapshot.value.entitlements) as Record<
      string,
      Entitlement
    >;
  } catch {
    return null;
  }
});

const entitlementGrants = computed(() =>
  Object.entries(parsedEntitlements.value ?? {}).toSorted(([a], [b]) =>
    a.localeCompare(b)
  )
);

const entitlementState = computed(() => {
  if (entitlementLoading.value)
    return { label: "Loading", color: "neutral" as const };
  if (entitlementError.value)
    return { label: "Unreadable", color: "error" as const };
  if (!entitlementSnapshot.value)
    return { label: "Missing", color: "warning" as const };
  if (!parsedEntitlements.value)
    return { label: "Unreadable", color: "error" as const };
  const validUntil = entitlementSnapshot.value.validUntil;
  if (validUntil && new Date(validUntil) <= new Date()) {
    return { label: "Expired", color: "error" as const };
  }
  return { label: "Available", color: "success" as const };
});

const selfClaimTooltip = computed(() =>
  isSelfClaimAdmin.value
    ? "Local Admin is active on this device. Server APIs and shared sync keep their own authorization. Click to revoke."
    : "Grant Admin to the local UI and local-first actions on this device. Server APIs and shared sync keep their own authorization."
);

watch([open, () => actor.value.id], ([isOpen]) => {
  if (isOpen) void loadEntitlementSnapshot();
});

// ── Handlers ─────────────────────────────────────────────────────────────
function formatEntitlementDate(value: string | null): string {
  return value ? new Date(value).toLocaleString() : "No explicit expiry";
}

async function loadEntitlementSnapshot() {
  entitlementLoading.value = true;
  entitlementError.value = null;
  try {
    entitlementSnapshot.value = await entitlementService.getSnapshot(
      actor.value.id
    );
  } catch {
    entitlementSnapshot.value = null;
    entitlementError.value =
      "Peaky could not read this device's authorization snapshot.";
  } finally {
    entitlementLoading.value = false;
  }
}

function onToggleSelfClaim(next: boolean) {
  setSelfClaimAdmin(next);
}

function onSignOut() {
  // logout() returns whatever navigateTo yields — discard it so the
  // @click handler's void-shaped signature stays clean.
  void logout();
}

function onSignIn() {
  // login() returns a navigateTo promise; discard it so the @click handler
  // stays void-shaped and the OIDC redirect initiates.
  void login();
}

function onDevPickerSave(nextActor: LifecycleActor) {
  const didSwitch = nextActor.id !== actor.value.id;
  setDevActor(nextActor);
  toast.add({
    title: didSwitch ? `Switched to ${nextActor.name}` : "Profile updated",
    color: "success",
  });
  open.value = false;
}
</script>

<template>
  <UModal v-model:open="open" title="Profile" :ui="{ content: 'max-w-xl' }">
    <!-- Forward the trigger the parent places as default slot content. -->
    <slot />
    <template #body>
      <!-- Dev-only local profile — shown when OIDC is not configured
           (`oidcEnabled === false`, e.g. local `make watch` without
           `NUXT_OIDC_*` env vars). See issue #89. -->
      <DevActorPickerBody
        v-if="!oidcEnabled"
        ref="devPickerRef"
        :open="open"
        :current-actor="actor"
        @save="onDevPickerSave"
      />

      <template v-else>
        <div class="flex flex-col items-center gap-4 px-1 py-2 text-center">
          <div
            class="bg-primary/15 text-primary inline-flex h-20 w-20 items-center justify-center overflow-hidden rounded-full text-2xl font-bold"
            aria-hidden="true"
          >
            <img
              v-if="user?.picture"
              :src="user.picture"
              :alt="user.name ?? ''"
              class="h-full w-full object-cover"
            />
            <template v-else>{{ userInitials }}</template>
          </div>

          <div class="space-y-1">
            <h3 class="text-highlighted text-lg font-semibold">
              {{ user?.name ?? "Signed in" }}
            </h3>
            <p
              v-if="user?.email"
              class="text-muted inline-flex items-center justify-center gap-1.5 text-sm"
            >
              <span>{{ user.email }}</span>
              <span
                v-if="user.email_verified"
                class="text-success inline-flex items-center gap-1 text-xs"
              >
                <Icon
                  name="lucide:badge-check"
                  class="h-3.5 w-3.5"
                  aria-label="Okta-verified email"
                />
                <span class="sr-only">Okta-verified</span>
              </span>
            </p>
          </div>

          <UBadge
            v-if="effectiveIsAdmin"
            color="success"
            variant="subtle"
            size="md"
          >
            <Icon
              name="lucide:shield-check"
              class="mr-1 h-3.5 w-3.5"
              aria-hidden="true"
            />
            Admin
          </UBadge>
        </div>

        <!-- Local-only admin self-claim. Until Cedar authz + the Authorisation
             Policies UI ship, this lets a signed-in user elevate to Admin role
             without depending on a `peaky-admins` LDAP group. See
             openspec/changes/oidc-okta-auth/design.md §9 for the planned
             Authority Policies / Cedar evolution. -->
        <div class="border-default mt-4 border-t pt-4">
          <UTooltip
            :text="selfClaimTooltip"
            :delay-duration="0"
            :content="{ side: 'top' }"
          >
            <label
              class="hover:bg-muted flex cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 transition-colors duration-150"
            >
              <span class="flex items-center gap-2 text-sm">
                <Icon
                  name="lucide:user-cog"
                  class="text-warning h-4 w-4"
                  aria-hidden="true"
                />
                Self-claim Admin
              </span>
              <USwitch
                :model-value="isSelfClaimAdmin"
                size="sm"
                aria-label="Self-claim Admin role (Cedar placeholder)"
                aria-describedby="self-claim-warning"
                @update:model-value="onToggleSelfClaim"
              />
            </label>
          </UTooltip>
          <p
            id="self-claim-warning"
            class="text-warning mt-2 px-2 text-xs leading-snug"
            role="note"
          >
            This grants Admin to the local UI and local-first actions on this
            device. Server APIs and shared sync still use session authorization.
          </p>
        </div>

        <div class="border-default mt-2 border-t pt-4">
          <details class="group">
            <summary
              class="text-dimmed hover:text-muted hover:bg-muted flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-[13px] font-medium transition-colors duration-150 select-none"
            >
              <span>Identity details (for support)</span>
              <Icon
                name="lucide:chevron-down"
                class="h-4 w-4 transition-transform group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <dl class="mt-3 space-y-2 text-xs">
              <div class="flex items-start justify-between gap-3">
                <dt class="text-dimmed shrink-0">Sub</dt>
                <dd class="text-default font-mono break-all">
                  {{ user?.sub ?? "—" }}
                </dd>
              </div>
              <div
                v-if="user?.ldap_uid"
                class="flex items-start justify-between gap-3"
              >
                <dt class="text-dimmed shrink-0">Username</dt>
                <dd class="text-default font-mono break-all">
                  {{ user.ldap_uid }}
                </dd>
              </div>
              <div
                v-if="user?.groups && user.groups.length > 0"
                class="flex items-start justify-between gap-3"
              >
                <dt class="text-dimmed shrink-0">Groups</dt>
                <dd class="text-default text-right">
                  <span
                    v-for="group in user.groups"
                    :key="group"
                    class="border-default bg-muted text-muted mr-1 inline-flex items-center rounded-md border px-2 py-1 font-mono text-xs font-medium"
                  >
                    {{ group }}
                  </span>
                </dd>
              </div>
            </dl>
          </details>
        </div>
      </template>

      <div class="border-default mt-4 border-t pt-4">
        <details class="group">
          <summary
            class="hover:bg-muted flex cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-2 text-sm font-semibold select-none"
          >
            <span class="flex items-center gap-2">
              <Icon name="lucide:shield-check" class="text-primary h-4 w-4" />
              Access on this device
            </span>
            <span class="flex items-center gap-2">
              <UBadge
                :color="entitlementState.color"
                variant="subtle"
                size="sm"
              >
                {{ entitlementState.label }}
              </UBadge>
              <Icon
                name="lucide:chevron-down"
                class="text-dimmed h-4 w-4 transition-transform group-open:rotate-180"
              />
            </span>
          </summary>

          <div class="mt-3 px-2">
            <p v-if="entitlementError" class="text-error text-[13px]">
              {{ entitlementError }}
            </p>
            <p
              v-else-if="!entitlementSnapshot && !entitlementLoading"
              class="text-muted text-[13px]"
            >
              Shared sync authorization is unavailable on this device.
              Local-only actions may still work.
            </p>
            <template v-else-if="entitlementSnapshot">
              <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[13px]">
                <dt class="text-dimmed">Actor</dt>
                <dd class="text-default text-right font-mono break-all">
                  {{ entitlementSnapshot.actorId }}
                </dd>
                <dt class="text-dimmed">Snapshot</dt>
                <dd class="text-default text-right font-medium">
                  v{{ entitlementSnapshot.snapshotVersion }} ·
                  {{ entitlementGrants.length }} grants
                </dd>
                <dt class="text-dimmed">Refreshed</dt>
                <dd class="text-default text-right">
                  {{
                    formatEntitlementDate(
                      entitlementSnapshot.refreshAt ??
                        entitlementSnapshot.createdAt
                    )
                  }}
                </dd>
                <dt class="text-dimmed">Valid until</dt>
                <dd class="text-default text-right">
                  {{ formatEntitlementDate(entitlementSnapshot.validUntil) }}
                </dd>
              </dl>

              <div
                v-if="entitlementGrants.length > 0"
                class="border-default mt-4 max-h-44 space-y-1 overflow-y-auto border-t pt-3"
              >
                <div
                  v-for="[scope, grant] in entitlementGrants"
                  :key="scope"
                  class="bg-muted grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 rounded-md px-2.5 py-2 text-xs"
                >
                  <span class="text-default truncate font-mono" :title="scope">
                    {{ scope }}
                  </span>
                  <span :class="grant.canView ? 'text-success' : 'text-dimmed'">
                    View {{ grant.canView ? "yes" : "no" }}
                  </span>
                  <span :class="grant.canEdit ? 'text-success' : 'text-dimmed'">
                    Edit {{ grant.canEdit ? "yes" : "no" }}
                  </span>
                </div>
              </div>
            </template>
          </div>
        </details>
      </div>
    </template>

    <template #footer>
      <div
        v-if="!oidcEnabled"
        class="flex w-full items-center justify-end gap-2"
      >
        <UButton
          size="md"
          color="neutral"
          variant="ghost"
          @click="open = false"
        >
          Cancel
        </UButton>
        <UButton
          size="md"
          color="primary"
          :disabled="!devPickerRef?.canSave"
          @click="devPickerRef?.save()"
        >
          Save profile
        </UButton>
      </div>

      <div v-else class="flex w-full flex-col gap-3">
        <p class="text-dimmed text-center text-xs">
          Identity managed by Adyen SSO. Signing out clears your session and
          signs you out of Okta.
        </p>
        <div class="flex items-center justify-end gap-2">
          <UButton
            size="md"
            color="neutral"
            variant="ghost"
            @click="open = false"
          >
            Close
          </UButton>
          <UButton
            v-if="isLoggedIn"
            size="md"
            color="neutral"
            variant="solid"
            @click="onSignOut"
          >
            Sign out
          </UButton>
          <UButton
            v-else
            size="md"
            color="primary"
            variant="solid"
            @click="onSignIn"
          >
            Sign in
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
