# TypeScript Review Context

## Scope

TypeScript in the Nuxt browser application, Nitro server routes, composables,
local database modules, and stateful mutation/service/log modules.

## Project invariants

- Entity reads are local-first: guard server execution, wait for
  `waitForLocalDbReady()`, surface SQLite data immediately, and use remote data
  only for initial hydration or background synchronization.
- Local mutations update reactive state immediately and queue the outbox.
  Network completion must not gate user-visible state.
- `localCursor` and `remoteCursor` are separate. Pull responses never advance
  the push cursor, and bootstrap leaves the remote cursor unset for a full
  replay.
- A `useLocalStorage` value that changes rendered branches must avoid Nuxt
  hydration mismatch with `<ClientOnly>` or
  `initializeWithValue: false`.

## Project conventions

- Stateful modules in `app/services/`, local database service/log files, and
  files named `*Mutations.ts`, `*Service.ts`, or `*Log.ts` use a class plus a
  singleton export. Established examples are `LocalMutation`,
  `AnswerMutations`, `ProductMutations`, `ReviewMutations`, and `MigrationLog`.
- Composables own reactive state and expose read-only refs. Pure transformations
  belong in plain modules.
- Explicit file imports are preferred over composable barrel imports.
- The build targets modern Chrome/ES2024 and `esnext`.
- Intentional accepted idiom: `void asyncFn()` marks a deliberately un-awaited
  background operation and should not be treated as misuse of `void`.
- For growing question, checklist, contributor, or review collections, derive
  lookup maps once rather than scanning inside each computed item or template
  callback. Parallel fetches over user-sized collections must have a bound.

## Deterministic coverage

Do not repeat rules enforced by `pnpm lint`: nullish defaults, optional
chaining, inferred primitive types, type-only imports, lookup-oriented
`includes`, existence-oriented `find`, deprecated string slicing, global
number predicates, accumulating spread, two-callback `then`, sequence
expressions, more than four parameters, nesting over three levels, and modules
over 400 lines.

Relevant gates are `pnpm lint`, `make typecheck`, and `make test`.

## References

- `site/docs/development/typescript.md`
- `eslint.config.mjs`
- `.oxlintrc.json`
- `app/services/local-mutation.ts`
- `app/services/entity/AnswerMutations.ts`
- `app/services/entity/ProductMutations.ts`
- `app/services/entity/ReviewMutations.ts`
- `app/local-db/migration-log.ts`
- `DESIGN.md` (sync cursor and bootstrap sections)
