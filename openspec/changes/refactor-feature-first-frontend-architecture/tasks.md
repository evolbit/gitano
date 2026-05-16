## 1. Foundation

- [x] 1.1 Add frontend test tooling, test scripts, and a minimal test setup file.
- [x] 1.2 Add `src/app`, `src/features`, `src/shared`, and `src/test` target directories with documented index boundaries where useful.
- [x] 1.3 Add TypeScript/Vite aliases for `@/app`, `@/features`, and `@/shared`.
- [x] 1.4 Verify the unchanged app still builds after the foundation setup.

## 2. Shared Layer

- [x] 2.1 Move generic path helpers to `src/shared/lib/path` with compatibility exports from the legacy path.
- [x] 2.2 Move generic branch/file tree helpers to `src/shared/lib/tree` with compatibility exports from the legacy paths.
- [x] 2.3 Move generic UI helpers and constants to `src/shared/ui` and `src/shared/config` with compatibility exports where needed.
- [x] 2.4 Add focused tests for migrated path helpers, tree helpers, and staged selection utilities.
- [x] 2.5 Verify build and tests after shared utility migration.

## 3. Platform And API Adapters

- [x] 3.1 Add shared typed adapters for Tauri storage, dialogs, app events, window APIs, and command invocation.
- [x] 3.2 Move reusable repository-opening behavior behind a shared or feature API boundary.
- [x] 3.3 Introduce typed Git command adapter groups for branches, commits, diffs, staging, stashes, worktrees, tags, and realtime events.
- [x] 3.4 Update low-risk consumers to use the new adapters while preserving backend command names and payloads.
- [x] 3.5 Add adapter tests or mocks that verify command names and payload shapes without a live Tauri runtime.

## 4. App Layer

- [x] 4.1 Move i18n and Mantine theme setup from `main.tsx` into app provider modules.
- [x] 4.2 Move window persistence startup behavior into an app bootstrap module backed by shared platform adapters.
- [x] 4.3 Move tab shell orchestration from `App.tsx` into `src/app` while preserving the home tab behavior.
- [x] 4.4 Verify persisted workspace state and startup behavior still work after app layer migration.

## 5. Feature Migration

- [x] 5.1 Migrate launchpad and repository opening code into a launchpad feature.
- [x] 5.2 Migrate tab bar and repository tab layout orchestration into a repository workspace feature.
- [x] 5.3 Migrate branches components, hooks, types, API, and utilities into a branches feature.
- [x] 5.4 Migrate changes explorer, staging selection, and commit bar code into a working changes feature.
- [x] 5.5 Migrate diff viewer and diff modal code into a diffs feature.
- [x] 5.6 Migrate commit list and commit changes panel code into a commits/history feature.
- [x] 5.7 Migrate stashes, worktrees, and tags panels into their owning feature folders.
- [x] 5.8 Add feature-local tests for migrated hooks, stores, and high-risk component behaviors in each migrated feature.
- [x] 5.9 Verify build and tests after each feature slice.

## 6. Store And Type Boundaries

- [x] 6.1 Move feature-owned Zustand stores to the owning feature.
- [x] 6.2 Keep only app-wide or truly shared stores in the shared/app layer.
- [x] 6.3 Move feature-owned TypeScript types into feature-local `types.ts` or `types` folders.
- [x] 6.4 Keep backend DTOs and cross-feature Git domain types in `src/shared/types` or typed API modules.
- [x] 6.5 Add store tests for state transitions that affect persisted tabs, workspace UI, staging, and diff hunks.

## 7. Cleanup And Verification

- [x] 7.1 Update all new-code imports to target architecture paths and remove obsolete compatibility exports.
- [x] 7.2 Remove empty legacy top-level buckets once consumers have migrated.
- [x] 7.3 Update README architecture documentation to describe the feature-first layout.
- [x] 7.4 Run frontend build and the full test suite.
- [x] 7.5 Review the final file tree for dependency direction violations and unresolved TODO migration notes.
