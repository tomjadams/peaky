# Vue Review Context

## Scope

Vue 3 single-file components and Nuxt page composition in `app/`.

## Project invariants

- Components render entity data from browser SQLite, not direct `$fetch` or
  `useFetch` calls. Synchronization is background work and must not block local
  content behind a spinner.
- Answer writes use the tracked mutation path. Calls that update answer state,
  including N/A and checklist modal confirmations, also schedule an answer
  draft so the outbox is not bypassed.
- The immediate UI update occurs before any asynchronous persistence or sync
  work.
- Local-storage-backed branch selection is hydration-safe through
  `<ClientOnly>` or deferred initialization.

## Project conventions

- Components use `<script setup lang="ts">` ordered as imports, props/emits,
  constants, reactive state, computed values, watchers, handlers, and lifecycle
  hooks.
- Composables are imported explicitly from their files.
- Complex template expressions become computed state. Side effects belong in
  watchers or handlers, not computed getters.
- Modal confirmation handlers are a specific review boundary because they can
  bypass `handleAnswer` or `handleAnswerWithTracking`.
- Sync state is shown by a non-blocking status indicator while local content
  remains available.

## References

- `site/docs/development/vue.md`
- `site/docs/development/typescript.md` (local-first data access)
- `README.md`
- `app/composables/reviews/useReviewData.ts`
