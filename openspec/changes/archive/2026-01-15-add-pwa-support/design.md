## Context
ORR is a web application that users access frequently for operational readiness reviews. Providing PWA support allows users to install the app on their desktop for quick access without opening a browser tab.

## Goals / Non-Goals

### Goals
- Enable browser-based installation of ORR as a standalone desktop app
- Provide consistent branding across PWA icon, favicon, and in-app logo
- Support offline caching for static assets
- Auto-update service worker when new versions are deployed

### Non-Goals
- Push notifications (future consideration)
- Full offline functionality for data operations (requires backend sync)
- Mobile-specific optimizations (focus is desktop)

## Decisions

### Module Choice
- Decision: Use `@vite-pwa/nuxt` instead of `@nuxtjs/pwa`
- Rationale: `@nuxtjs/pwa` is not compatible with Nuxt 3/4. `@vite-pwa/nuxt` is the official zero-config PWA solution for Nuxt 3+ applications, built on Vite Plugin PWA and Workbox.

### Icon Format
- Decision: Use SVG format for PWA icons
- Rationale: SVGs are resolution-independent, smaller file size, and easier to maintain. Modern browsers and PWA installers support SVG icons.

### Icon Design
- Decision: Match the existing in-app logo (checkmark above "ORR" text on dark slate background)
- Rationale: Consistent branding across all touchpoints (favicon, PWA icon, sidebar logo).

### Service Worker Strategy
- Decision: Use `autoUpdate` registration type with Workbox
- Rationale: Ensures users always get the latest version without manual intervention. Suitable for an internal tool where silent updates are preferred.

### Manifest Configuration
- `display: standalone` - App opens in its own window without browser chrome
- `theme_color: #0f172a` - Dark slate matching the app's dark mode theme
- `background_color: #ffffff` - White splash screen for light mode default

## Risks / Trade-offs
- SVG icons may not be supported by older browsers/platforms
  - Mitigation: Can add PNG fallbacks if needed in future
- Service worker caching may serve stale content briefly
  - Mitigation: `autoUpdate` + `navigateFallback` ensure fresh content on reload
