# Tasks

## 1. PWA Module Setup
- [x] 1.1 Install `@vite-pwa/nuxt` module
- [x] 1.2 Configure PWA in `nuxt.config.ts` with manifest, service worker, and dev options
- [x] 1.3 Add `<NuxtPwaManifest />` component to `app.vue`

## 2. Icon Assets
- [x] 2.1 Create `public/pwa-192x192.svg` with ORR branding (checkmark + "ORR" text)
- [x] 2.2 Create `public/pwa-512x512.svg` with matching design
- [x] 2.3 Add `public/favicon.svg` and update `app.vue` to prefer SVG favicon

## 3. Validation
- [x] 3.1 Verify PWA installability in Chrome DevTools → Application → Manifest
- [x] 3.2 Test install flow on desktop browser
- [x] 3.3 Verify service worker registration
