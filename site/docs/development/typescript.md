# TypeScript & JavaScript Conventions

This document describes the TypeScript/JavaScript patterns and conventions used in the Peaky project.

## Target Environment

- **Browser**: Modern Chrome (ES2024+)
- **Node**: v20+
- **Build Target**: `esnext` (no transpilation to older JS)

See [TARGETS.md](/site/docs/targets/) for full details.

## Key ES2024 Patterns

### Nullish Coalescing (`??`) vs Logical OR (`||`)

Use `??` when you want to default `null`/`undefined` only, not all falsy values (0, `false`, `''`).

```typescript
// ✅ Good - preserves 0, false, ''
const count = value ?? 0;
const enabled = flag ?? true;
const items = data ?? [];
const title = name ?? "Untitled";

// ❌ Avoid - loses falsy values
const count = value || 0;  // converts 0 to 0 (works but semantically wrong)
const enabled = flag || true;  // loses false
```

**When to use `||`**: When you genuinely want to treat falsy values (0, `false`, `''`) as missing.

```typescript
// ✅ OK - intentional falsy check
if (items.length === 0 || isLoading) { ... }
```

### Optional Chaining (`?.`)

Use optional chaining for safe property access without nested `if` checks.

```typescript
// ✅ Good
const owner = application?.owner ?? "Unassigned";
const status = review?.status ?? "DRAFT";
const reviewers = user?.reviewers ?? [];

// ❌ Avoid - verbose null checks
const owner = application && application.owner ? application.owner : "Unassigned";
```

### Copy-on-Write Array Methods

Use immutable array methods to avoid mutations that cause subtle bugs.

#### `Array.toSorted()`

Return a new sorted array instead of mutating in-place.

```typescript
// ✅ Good
const sorted = items.toSorted((a, b) => a.name.localeCompare(b.name));

// ❌ Avoid - mutation
items.sort((a, b) => a.name.localeCompare(b.name));
const sorted = [...items].sort(...);  // spread pattern - verbose
```

#### `Array.toReversed()`

Return a new reversed array.

```typescript
// ✅ Good
const reversed = items.toReversed();

// ❌ Avoid
const reversed = [...items].reverse();
```

#### `Array.toSpliced()`

Immutably modify array elements.

```typescript
// ✅ Good
const updated = items.toSpliced(index, 1, newItem);

// ❌ Avoid
const updated = [...items];
updated.splice(index, 1, newItem);
```

Note: Not yet widely used in codebase but available.

### Object.groupBy() for Grouping

Group array elements by a key function instead of manual reduce.

```typescript
// ✅ Good (when available)
const grouped = Object.groupBy(applications, (app) => app.status);

// ❌ Avoid
const grouped = applications.reduce((acc, app) => {
  (acc[app.status] ??= []).push(app);
  return acc;
}, {} as Record<string, Application[]>);
```

## TypeScript Type Conventions

### Null vs Undefined

Prefer `undefined` for "missing value" semantics, `null` for "explicitly empty/intentionally no value".

```typescript
// ✅ Good - optional parameters default to undefined
function fetchData(id?: string) { ... }

// ✅ Good - explicit null when value is intentionally absent
interface QuestionAnswer {
  value: string | null;  // null means "not answered"
}

// ❌ Avoid - mixing types for "missing" vs "empty"
const value = response["data"] ?? null;  // unclear intent
```

### Safe Defaults

Use `??` with sensible defaults on the right side, not inside type unions.

```typescript
// ✅ Good
const count = data?.count ?? 0;
const name = user?.name ?? "Anonymous";

// ❌ Avoid
const count: number | undefined = data?.count;  // forces caller to handle undefined
```

### When `any` is Acceptable

Use `any` sparingly, only for these cases:

1. **External API responses with unknown shape** - add type guard ASAP
2. **Generic utility components** - constrain with `unknown` where possible
3. **Legacy code migration** - add TODO to replace with proper types

```typescript
// ✅ Acceptable - unknown API shape, will type guard
const response: unknown = await fetch(url);
if (typeof response === 'object' && response !== null) {
  // type guard here
}

// ✅ Better - use unknown with type guards
function processValue<T>(value: T): T { ... }

// ❌ Avoid - any without plan to fix
let data: any;
data.foo.bar.baz;  // no type checking
```

### Generic Type Parameters

Use descriptive type parameter names.

```typescript
// ✅ Good
export function useSortState<T extends Record<string, unknown>>(
  items: Ref<T[]>,
  defaultSortKey: string = "name"
) { ... }

// ❌ Avoid
export function useSortState<T>(items, sortKey) { ... }
```

## Local-first Data Access

Peaky is a local-first app. All composables that read entity data **must read from the local SQLite database first** and only fall back to (or sync from) remote if local has nothing.

**The required pattern:**

```typescript
// ✅ Correct — local first, remote only when local is empty
const loadData = async () => {
  if (import.meta.server) { loading.value = true; return; }

  loading.value = true;
  error.value = null;
  await waitForLocalDbReady();

  // 1. Try local first — surface immediately if found
  const local = await someRepository.fetch(id);
  if (local) {
    data.value = local;
    loading.value = false;
    return;
  }

  // 2. No local data — fetch remote and hydrate into local store
  try {
    const remote = await $fetch<SomeEntity>(`/api/some/${id}`);
    await someRepository.upsert(remote);
    data.value = await someRepository.fetch(id);
  } catch (e) {
    error.value = e instanceof Error ? e : new Error("Failed to fetch");
  } finally {
    loading.value = false;
  }
};
```

**Anti-patterns to avoid:**

```typescript
// ❌ Remote-first — breaks offline, slow on first paint
const data = await $fetch(`/api/some/${id}`);

// ❌ Remote with local fallback — still fetches remote on every load
try {
  return await $fetch(`/api/some/${id}`);
} catch {
  return await localRepository.fetch(id); // fallback only on error
}
```

**Rules:**

- Always call `waitForLocalDbReady()` before any local DB access
- Guard `import.meta.server` — local DB is client-only
- Surface local data immediately; never hold back a loading state while waiting for remote
- Remote is for initial seeding and sync, not for primary reads
- See `useReviewData` in `app/composables/reviews/useReviewData.ts` as the reference implementation

## Composable Patterns

### Explicit Imports

Always use explicit imports for composables—don't rely on Nuxt auto-imports.

```typescript
// ✅ Good
import { useSortState } from "~/composables/table/useSortState";
import { useApplications } from "~/composables/applications/useApplications";

// ❌ Avoid - may fail with barrel exports
import { useSortState, useApplications } from "~/composables";
```

### Pure Functions > Side Effects

Extract pure computations into separate functions.

```typescript
// ✅ Good - pure calculation in separate model
function calculateOverallProgress(review: Review): number {
  if (!review.pillars?.length) return 0;
  const total = review.pillars.reduce((sum, p) => sum + (p.progress ?? 0), 0);
  return Math.round(total / review.pillars.length);
}

// ❌ Avoid - mixing computation and side effects
const progress = computed(() => {
  // ...20 lines of calculation
  $fetch(`/api/update/${id}`);  // side effect!
  // ...more calculation
});
```

### Return Read-only State

Expose read-only refs from composables to prevent external mutation.

```typescript
// ✅ Good
return {
  answers: readonly(answers),
  setAnswer,
  clearAnswer,
};

// ❌ Avoid - allows external mutation
return {
  answers,
  setAnswer,
  clearAnswer,
};
```

## Error Handling

### Prefer Explicit Error Types

```typescript
// ✅ Good
try {
  const data = await $fetch<T>("/api/data");
  return { success: true, data };
} catch (error) {
  const errorObj = error instanceof Error ? error : new Error(String(error));
  return { success: false, error: errorObj };
}

// ❌ Avoid - loses type information
catch (error) {
  console.error(error);
  return null;
}
```

## Resources

- [ES2024 Features](https://github.com/tc39/proposals/blob/main/finished-proposals.md)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/)
- [Nuxt TypeScript](https://nuxt.com/docs/guide/going-further/typescript)
