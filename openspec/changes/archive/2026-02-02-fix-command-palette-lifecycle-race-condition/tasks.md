## 1. Project Management

- [x] 1.1 Create GitLab issue for tracking this change using `glab issue create` → #6
- [x] 1.2 Create GitLab MR with conventional commit title: `fix(command-palette): resolve lifecycle command race condition during navigation` → !27

## 2. Implementation (Already Complete)

- [x] 2.1 Add `registeredAtRoute` field to `RegisteredCommand` interface in `useCommandPalette.ts`
- [x] 2.2 Add `registeredAtRoute` field to `RegisteredSource` interface in `useCommandPalette.ts`
- [x] 2.3 Modify `registerCommand` to capture `route.path` for lifecycle-scoped commands
- [x] 2.4 Modify `registerSource` to capture `route.path` for lifecycle-scoped sources
- [x] 2.5 Update route watcher to filter by `registeredAtRoute` instead of clearing all lifecycle commands

## 3. Verification

- [x] 3.1 Run linting (`pnpm run lint --fix`) - passed with 0 errors
- [x] 3.2 Run unit tests (`pnpm test`) - all 263 tests passed
- [x] 3.3 Run build (`pnpm run build`) - successful
- [x] 3.4 Manual testing: verify command palette commands appear after multi-step navigation

## 4. Documentation

- [x] 4.1 Update decision log at `site/docs/maintainers/decisions.md` documenting the race condition fix approach
- [x] 4.2 Update GitLab issue with task completion status

## 5. Finalization

- [x] 5.1 Push branch and create MR
- [x] 5.2 Archive change after MR is merged using `openspec archive`
