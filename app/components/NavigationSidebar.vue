<script setup lang="ts">
import ProfileModal from "~/components/ProfileModal.vue";
import { useAuth } from "~/composables/useAuth";
import { useCurrentActor } from "~/composables/auth/useCurrentActor";
import { getInitial } from "~/utils/avatar";

withDefaults(defineProps<{ compact?: boolean }>(), { compact: false });

// Reactive state and composable calls are grouped per vue.md §4 so the
// derivation chain stays scannable.
const isProfileOpen = ref(false);

const { oidcEnabled } = useRuntimeConfig().public;

const { user } = useAuth();
const { actor, isSelfClaimAdmin } = useCurrentActor();

// When OIDC is not configured there is no session — the display name comes
// from the dev-only actor picker (`useCurrentActor`) instead. See issue #89.
const displayName = computed(() =>
  oidcEnabled ? (user.value?.name ?? "") : actor.value.name
);

// Mirror the modal's avatar initials on the trigger so the sidebar's
// affordance is recognisable at a glance (otherwise the trigger just
// shows a generic circle).
const userInitials = computed(() => getInitial(displayName.value));

// The trigger's tooltip leads with the action, not the affordance. The
// mirror copy in ProfileModal.vue must agree on this state.
const profileTooltip = computed(() => {
  if (!oidcEnabled) {
    const adminSuffix = actor.value.roles.includes("admin") ? " · Admin" : "";
    return `Switch dev identity (currently ${actor.value.name}${adminSuffix})`;
  }
  return isSelfClaimAdmin.value
    ? "Local Admin is active on this device; click to revoke"
    : "Grant Admin to local UI and local-first actions on this device";
});
</script>

<template>
  <aside
    class="nav-sidebar border-default bg-default fixed left-0 z-30 flex w-20 flex-col items-center justify-between border-r py-4"
    :class="compact ? 'inset-y-0' : 'nav-sidebar--below-header'"
  >
    <!-- Logo and App Name -->
    <div class="nav-sidebar__top flex flex-col items-center gap-4">
      <NuxtLink
        to="/"
        class="nav-sidebar__logo flex h-16 w-16 flex-col items-center justify-center gap-1"
      >
        <PeakyLogo :size="32" class="nav-sidebar__logo-icon" />
        <span
          class="nav-sidebar__logo-text text-primary text-sm font-bold tracking-wide"
        >
          Peaky
        </span>
      </NuxtLink>

      <!-- Navigation Items -->
      <nav class="nav-sidebar__menu flex flex-col items-center gap-2">
        <UTooltip
          text="Teams"
          :delay-duration="0"
          :content="{ side: 'right', sideOffset: 8 }"
        >
          <NuxtLink
            to="/teams"
            class="nav-sidebar__menu-item text-muted hover:bg-primary/10 hover:text-primary relative flex h-12 w-12 items-center justify-center rounded-lg"
            active-class="nav-sidebar__menu-item--active bg-primary/10 text-primary"
          >
            <Icon
              name="lucide:users"
              class="nav-sidebar__menu-icon text-2xl"
              aria-hidden="true"
            />
            <span class="sr-only">Teams</span>
          </NuxtLink>
        </UTooltip>

        <UTooltip
          text="Products"
          :delay-duration="0"
          :content="{ side: 'right', sideOffset: 8 }"
        >
          <NuxtLink
            to="/products"
            class="nav-sidebar__menu-item text-muted hover:bg-primary/10 hover:text-primary relative flex h-12 w-12 items-center justify-center rounded-lg"
            active-class="nav-sidebar__menu-item--active bg-primary/10 text-primary"
          >
            <Icon
              name="lucide:box"
              class="nav-sidebar__menu-icon text-2xl"
              aria-hidden="true"
            />
            <span class="sr-only">Products</span>
          </NuxtLink>
        </UTooltip>

        <UTooltip
          text="Applications"
          :delay-duration="0"
          :content="{ side: 'right', sideOffset: 8 }"
        >
          <NuxtLink
            to="/applications"
            class="nav-sidebar__menu-item text-muted hover:bg-primary/10 hover:text-primary relative flex h-12 w-12 items-center justify-center rounded-lg"
            active-class="nav-sidebar__menu-item--active bg-primary/10 text-primary"
          >
            <Icon
              name="lucide:layout-dashboard"
              class="nav-sidebar__menu-icon text-2xl"
              aria-hidden="true"
            />
            <span class="sr-only">Applications</span>
          </NuxtLink>
        </UTooltip>

        <UTooltip
          text="Templates"
          :delay-duration="0"
          :content="{ side: 'right', sideOffset: 8 }"
        >
          <NuxtLink
            to="/templates"
            class="nav-sidebar__menu-item text-muted hover:bg-primary/10 hover:text-primary relative flex h-12 w-12 items-center justify-center rounded-lg"
            active-class="nav-sidebar__menu-item--active bg-primary/10 text-primary"
          >
            <Icon
              name="lucide:file-text"
              class="nav-sidebar__menu-icon text-2xl"
              aria-hidden="true"
            />
            <span class="sr-only">Templates</span>
          </NuxtLink>
        </UTooltip>

        <UTooltip
          text="Events"
          :delay-duration="0"
          :content="{ side: 'right', sideOffset: 8 }"
        >
          <NuxtLink
            to="/events"
            class="nav-sidebar__menu-item text-muted hover:bg-primary/10 hover:text-primary relative flex h-12 w-12 items-center justify-center rounded-lg"
            active-class="nav-sidebar__menu-item--active bg-primary/10 text-primary"
          >
            <Icon
              name="lucide:history"
              class="nav-sidebar__menu-icon text-2xl"
              aria-hidden="true"
            />
            <span class="sr-only">Events</span>
          </NuxtLink>
        </UTooltip>
      </nav>
    </div>

    <!-- User Profile and Settings -->
    <div class="nav-sidebar__bottom flex flex-col items-center gap-2">
      <UTooltip
        text="Help (coming soon)"
        :delay-duration="0"
        :content="{ side: 'right', sideOffset: 8 }"
      >
        <a
          class="nav-sidebar__menu-item text-dimmed relative flex h-12 w-12 cursor-not-allowed items-center justify-center rounded-lg opacity-50"
          href="#"
          @click.prevent
        >
          <Icon
            name="lucide:help-circle"
            class="nav-sidebar__menu-icon text-2xl"
            aria-hidden="true"
          />
          <span class="sr-only">Help (coming soon)</span>
        </a>
      </UTooltip>

      <UTooltip
        text="System"
        :delay-duration="0"
        :content="{ side: 'right', sideOffset: 8 }"
      >
        <NuxtLink
          to="/system"
          class="nav-sidebar__menu-item text-muted hover:bg-primary/10 hover:text-primary relative flex h-12 w-12 items-center justify-center rounded-lg"
          active-class="nav-sidebar__menu-item--active bg-primary/10 text-primary"
        >
          <Icon
            name="lucide:activity"
            class="nav-sidebar__menu-icon text-2xl"
            aria-hidden="true"
          />
          <span class="sr-only">System</span>
        </NuxtLink>
      </UTooltip>

      <UTooltip
        text="Settings (coming soon)"
        :delay-duration="0"
        :content="{ side: 'right', sideOffset: 8 }"
      >
        <a
          class="nav-sidebar__menu-item text-dimmed relative flex h-12 w-12 cursor-not-allowed items-center justify-center rounded-lg opacity-50"
          href="#"
          @click.prevent
        >
          <Icon
            name="lucide:settings"
            class="nav-sidebar__menu-icon text-2xl"
            aria-hidden="true"
          />
          <span class="sr-only">Settings (coming soon)</span>
        </a>
      </UTooltip>

      <ProfileModal v-model:open="isProfileOpen">
        <UTooltip
          :text="profileTooltip"
          :delay-duration="0"
          :content="{ side: 'right', sideOffset: 8 }"
        >
          <button
            type="button"
            class="nav-sidebar__menu-item text-muted hover:bg-primary/10 hover:text-primary relative flex h-12 w-12 items-center justify-center rounded-lg"
          >
            <span
              class="bg-primary/10 text-primary inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold"
              aria-hidden="true"
            >
              {{ userInitials }}
            </span>
            <span class="sr-only">Profile</span>
          </button>
        </UTooltip>
      </ProfileModal>
    </div>
  </aside>
</template>

<style scoped>
.nav-sidebar--below-header {
  --nav-sidebar-fallback-height: 9.0625rem;
  --nav-sidebar-header-height: var(
    --app-header-height,
    var(--nav-sidebar-fallback-height)
  );

  top: var(--nav-sidebar-header-height);
  height: calc(100vh - var(--nav-sidebar-header-height));
}

@media (min-width: 640px) {
  .nav-sidebar--below-header {
    --nav-sidebar-fallback-height: 5rem;
  }
}
</style>
