# Add PWA Support

## Why
Users want to install ORR as a standalone desktop application directly from the browser, providing a native-like experience without requiring a separate distribution mechanism.

## What
- Add Progressive Web App (PWA) support using `@vite-pwa/nuxt` module
- Create branded SVG icons for the PWA manifest (192x192 and 512x512)
- Update the favicon to use the same branded icon for consistency
- Configure service worker for offline capability and auto-updates

## Impact
- **layout spec**: Adds PWA requirements for installability and branding
- **nuxt.config.ts**: PWA module configuration
- **public/**: New icon assets
