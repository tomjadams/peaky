// https://nuxt.com/docs/api/configuration/nuxt-config
import sqlocal from "sqlocal/vite";
import { parseTemplatePublishingEnabled } from "./shared/config/template-publishing";

// OIDC is the sole authentication mechanism for Peaky. Required env vars for
// the through-the-front-door flow: DOMAIN, CLIENT_ID, PRIVATE_KEY (JWK JSON
// for `private_key_jwt`), SESSION_SECRET. For a quick fake session without
// an IdP, set SESSION_SECRET alone and visit /auth/dev/login — only outside
// production.
const oidcEnabled = Boolean(
  process.env.NUXT_OIDC_OKTA_DOMAIN &&
  process.env.NUXT_OIDC_OKTA_CLIENT_ID &&
  process.env.NUXT_OIDC_OKTA_PRIVATE_KEY &&
  process.env.NUXT_OIDC_SESSION_SECRET
);

// Test helpers (`window.__peakySeed` for E2E seeding, `window.peakyDB` for
// debug introspection) are exposed everywhere EXCEPT real production. This
// is what lets Playwright run against a Vercel preview deployment instead
// of forcing tests to a local dev server. The fall-through is the safe
// default — local dev (VERCEL_ENV unset) and previews both enable; only
// `production` hides them.
const enableTestHelpers = process.env.VERCEL_ENV !== "production";
const templatePublishingEnabled = parseTemplatePublishingEnabled(
  process.env.NUXT_TEMPLATE_PUBLISHING_ENABLED
);

// nuxt-security only decorates document/API responses: it applies COOP/COEP/CORP
// via Nitro's `render:response` hook (nuxt-security/dist/runtime/nitro/plugins/
// 70-securityHeaders.js), which fires only inside Nitro's SSR render handler.
// Static files under `/_nuxt/**` (Vite build output — JS chunks, the SQLocal/
// wa-sqlite worker scripts, and the sqlite3 .wasm binary) are served directly by
// Nitro's public-asset handler (nitropack runtime/internal/static.mjs), which
// returns before the renderer ever runs, so that hook never fires for them.
// (nuxt-security *does* promote a small "safe for all resources" subset of
// headers — Referrer-Policy, X-Content-Type-Options, X-Frame-Options, etc., see
// `appliesToAllResources` in its utils/headers.mjs — into a genuine Nitro
// routeRule, but crossOriginResourcePolicy is deliberately excluded from that
// subset, so raising it in `security.headers` above cannot fix this.)
// Under COEP: require-corp, Chromium blocks worker scripts fetched without a
// Cross-Origin-Resource-Policy header (net::ERR_BLOCKED_BY_RESPONSE) even when
// same-origin — breaking the SQLocal/OPFS worker and, with it, every page that
// reads the local DB. CORP alone isn't enough for `new Worker(...)`, though:
// Chromium treats a dedicated worker's top-level script like a nested "frame"
// resource, so it also enforces its own embedder-policy check on that response
// (confirmed via CDP: Network.loadingFailed reports blockedReason
// "coep-frame-resource-needs-coep-header" for the worker script even after CORP
// is added) — so the worker script response needs its own COEP header too, not
// just CORP. Set both here via a plain Nitro routeRule, which Nitro applies to
// every matching request path unconditionally (its route-rules handler runs
// ahead of both the renderer and the static-asset handler) — this is how the
// `_nuxt/**` Cache-Control immutable rule already reaches these same assets in
// both this app and vercel.json's CDN-edge headers.
const routeRules: NonNullable<
  Parameters<typeof defineNuxtConfig>[0]["routeRules"]
> = {
  "/_nuxt/**": {
    headers: {
      "Cross-Origin-Resource-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  // ── Dev-only sync proxy ────────────────────────────────────────────────
  // When NUXT_SYNC_BACKEND_URL / NUXT_SSE_BACKEND_URL are set (local `make
  // watch` only), Nitro forwards requests to the respective Go containers.
  // In production, ALB path routing handles this — no Nitro proxy in the path.
  ...(process.env.NUXT_SYNC_BACKEND_URL && {
    "/api/sync/**": {
      proxy: `${process.env.NUXT_SYNC_BACKEND_URL}/api/sync/**`,
    },
    "/api/catalog-directory-mirror/**": {
      proxy: `${process.env.NUXT_SYNC_BACKEND_URL}/api/catalog-directory-mirror/**`,
    },
    "/api/attachments/**": {
      proxy: `${process.env.NUXT_SYNC_BACKEND_URL}/api/attachments/**`,
    },
  }),
  ...(process.env.NUXT_SSE_BACKEND_URL && {
    "/api/sse/**": {
      proxy: `${process.env.NUXT_SSE_BACKEND_URL}/api/sse/**`,
    },
  }),
};

export default defineNuxtConfig({
  devServer: {
    port: 3000,
  },
  typescript: {
    typeCheck: false,
    strict: true,
  },
  nitro: {
    esbuild: {
      options: {
        // Nitro defaults its server-bundle esbuild target to es2019, which
        // warns on the BigInt literals in app/services/maturity/ratio.ts
        // (exact-ratio arithmetic is ES2020+; every runtime we serve is
        // modern Node). Align with the Vite targets below.
        target: "esnext",
      },
    },
  },
  vite: {
    optimizeDeps: {
      include: [
        "@microsoft/fetch-event-source",
        "@tiptap/extension-character-count",
        "@tiptap/extension-placeholder",
        "@tiptap/starter-kit",
        "@tiptap/vue-3",
        "@vueuse/core",
        "drizzle-orm",
        "drizzle-orm/sqlite-core",
        "drizzle-orm/sqlite-proxy",
        "fuse.js",
        "sortablejs",
        "uuid",
        "zod",
      ],
    },
    build: {
      target: "esnext",
    },
    esbuild: {
      target: "esnext",
    },
    server: {
      watch: {
        ignored: [
          "**/node_modules/**",
          "**/.nuxt/**",
          "**/.output/**",
          "**/dist/**",
          "**/.git/**",
          "**/.factory/**",
          "**/.vscode/**",
          "**/.windsurf/**",
          "**/.husky/**",
          "**/site/**",
        ],
      },
    },
    plugins: [sqlocal()],
  },
  modules: [
    "@nuxt/eslint",
    "@nuxt/icon",
    "@nuxt/test-utils/module",
    "@nuxt/ui",
    // @tailwindcss/vite is registered by @nuxt/ui — do NOT add @nuxtjs/tailwindcss here.
    "@vite-pwa/nuxt",
    "nuxt-security",
  ],
  icon: {
    provider: "server",
    fallbackToApi: false,
    clientBundle: {
      scan: true,
      icons: ["lucide:ellipsis"],
    },
  },
  // @see site/docs/development/walkthroughs/local-first/security.md
  security: {
    headers: {
      // Required for SharedArrayBuffer + OPFS persistence (wa-sqlite).
      // Without these three, the browser blocks OPFS access entirely.
      crossOriginOpenerPolicy: "same-origin",
      crossOriginEmbedderPolicy: "require-corp",
      crossOriginResourcePolicy: "same-origin",
      // wasm-unsafe-eval: required for wa-sqlite WebAssembly compilation.
      // blob: in worker-src/connect-src: required for SQLocal OPFS proxy worker.
      contentSecurityPolicy: {
        "script-src": ["'self'", "'unsafe-inline'", "'wasm-unsafe-eval'"],
        "style-src": ["'self'", "'unsafe-inline'"],
        "img-src": ["'self'", "data:", "blob:"],
        "connect-src": [
          "'self'",
          "blob:",
          process.env.NUXT_OIDC_OKTA_DOMAIN ?? "",
        ].filter(Boolean),
        "worker-src": ["'self'", "blob:"],
        "font-src": ["'self'"],
        "object-src": ["'none'"],
        "base-uri": ["'none'"],
        "frame-ancestors": ["'none'"],
      },
      strictTransportSecurity: {
        maxAge: 31536000,
        includeSubdomains: true,
      },
      xContentTypeOptions: "nosniff",
      xFrameOptions: "DENY",
      referrerPolicy: "strict-origin-when-cross-origin",
    },
    // 500 req/min — high enough for parallel E2E tests, low enough to slow brute-force.
    rateLimiter: {
      tokensPerInterval: 500,
      interval: 60000,
    },
    requestSizeLimiter: {
      maxRequestSizeInBytes: 2_000_000, // 2MB
      maxUploadFileRequestInBytes: 10_000_000, // 10MB
    },
    xssValidator: {},
    corsHandler: false,
    hidePoweredBy: true,
  },
  // Public runtime config — exposed to the client bundle.
  // Use `useRuntimeConfig().public.<key>` to read from Vue components or
  // Nuxt plugins. Build-time values are baked in; runtime overrides via
  // env vars follow Nuxt's `NUXT_PUBLIC_*` convention.
  runtimeConfig: {
    // Private server-only config — never serialized to the client bundle.
    // Override via NUXT_* env vars (Nuxt convention).
    oidcOktaDomain: "",
    oidcOktaClientId: "",
    oidcOktaPrivateKey: "",
    oidcOktaLogoutUrl: "",
    oidcSessionSecret: "",
    templatePublishingEnabled,
    public: {
      templatePublishingEnabled,
      // True everywhere except real Vercel production. Read by
      // `app/plugins/test-seed.client.ts` and `app/plugins/local-db.client.ts`
      // to decide whether to expose `window.__peakySeed` and `window.peakyDB`.
      testHelpersEnabled: enableTestHelpers,
      // Exposes OIDC state to the client so the auth middleware can skip
      // the session check when Okta is not yet configured.
      oidcEnabled,
    },
  },
  devtools: {
    enabled: true,
  },
  experimental: {
    emitRouteChunkError: "manual",
  },
  css: ["~/assets/css/main.css"],
  colorMode: {
    preference: "light",
  },
  // Disabled because CI is air-gapped and cannot reach external font CDNs.
  // Fonts are vendored in public/fonts/ via manual @font-face declarations.
  // We use the 'local' provider so @nuxt/fonts (pulled in transitively by
  // @nuxt/ui) never attempts external network calls. All external providers
  // are explicitly disabled as a defence-in-depth measure.
  fonts: {
    provider: "local",
    families: [],
    providers: {
      google: false,
      bunny: false,
      fontshare: false,
      fontsource: false,
      adobe: false,
    },
  },
  ui: {
    theme: {
      colors: ["primary", "secondary", "success", "warning", "error", "info"],
    },
  },
  // Cross-origin isolation headers now managed by nuxt-security module above.
  // vercel.json still sets them for the CDN edge (nuxt-security only covers SSR).
  // See the `routeRules` const above for why `/_nuxt/**` needs its own CORP rule.
  routeRules,
  pwa: {
    disable: process.env.NODE_ENV === "test",
    registerType: "autoUpdate",
    devOptions: {
      enabled: false,
    },
    manifest: {
      name: "Peaky - Readiness Assessment",
      short_name: "Peaky",
      theme_color: "#0f172a",
      background_color: "#ffffff",
      display: "standalone",
      icons: [
        { src: "/pwa-192x192.svg", sizes: "192x192", type: "image/svg+xml" },
        { src: "/pwa-512x512.svg", sizes: "512x512", type: "image/svg+xml" },
      ],
    },
    workbox: {
      // Under COEP: require-corp, the SW must not precache JS/CSS/WASM because
      // cached responses are served without HTTP headers, and Chrome blocks any
      // response missing Cross-Origin-Resource-Policy. Only precache PWA shell
      // assets; everything else is served from the network (Vercel CDN).
      globPatterns: ["**/*.{ico,svg,webmanifest}"],
      globIgnores: ["docs/**"],
      navigateFallback: null,
      // @vite-pwa/nuxt injects _nuxt/builds/latest.json explicitly (bypassing
      // globIgnores). Filter it out to prevent stale build-ID cache mismatches.
      manifestTransforms: [
        (
          entries: { url: string; revision: string | null; size: number }[]
        ) => ({
          manifest: entries.filter((entry) => !entry.url.includes("builds/")),
        }),
      ],
    },
  },
  compatibilityDate: "2025-01-15",
  eslint: {
    config: {
      stylistic: false,
    },
  },
});
