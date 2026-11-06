<template>
  <div class="bg-default min-h-screen">
    <!-- Studio Navigation Sidebar -->
    <NavigationSidebar :compact="true" />

    <!-- Main content area with left offset for sidebar -->
    <div class="ml-20">
      <slot />
    </div>

    <AppCommandPalette />
  </div>
</template>
