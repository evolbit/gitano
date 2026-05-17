## Why

The frontend has grown around global buckets (`components`, `hooks`, `store`, `types`, `utils`) that now make ownership and dependency direction harder to understand. A staged feature-first refactor will make Git workflows easier to maintain, safer to test, and simpler to extend without changing the user-facing behavior.

## What Changes

- Introduce a feature-first source layout that groups workflow-owned UI, hooks, stores, types, and local utilities by domain.
- Introduce a `shared` layer for reusable design primitives, platform adapters, application constants, generic types, and pure utilities that are not owned by a single feature.
- Define import and dependency rules so features can depend on `shared` and app composition, while `shared` remains feature-independent.
- Move common Tauri/Git command access behind typed platform APIs instead of invoking backend commands directly from many components.
- Add a frontend test setup and focused tests for pure utilities, feature hooks, stores, and high-risk component behavior.
- Migrate existing modules incrementally, keeping compatibility exports where useful so the refactor can proceed without a single large rewrite.
- Preserve current runtime behavior, visual output, persisted state shape, and backend command contracts unless a future feature change explicitly modifies them.

## Capabilities

### New Capabilities

- `feature-first-frontend-architecture`: Covers the required frontend folder layout, ownership boundaries, dependency direction, migration compatibility, and testing expectations for feature-first architecture.
- `typed-platform-adapters`: Covers typed frontend adapters for Tauri dialogs, events, storage, window management, and Git command invocation.

### Modified Capabilities

- `component-folder-organization`: Extend component organization rules so reusable components live under shared UI while feature-owned components live inside feature folders.
- `shared-tree-and-path-utilities`: Extend shared utility rules so existing tree and path helpers become part of the `shared` layer contract with tests.

## Impact

- Affected frontend files under `src/`, especially `components`, `hooks`, `store`, `types`, `utils`, `constants`, `App.tsx`, and `main.tsx`.
- New directories such as `src/app`, `src/features`, `src/shared`, and `src/test` may be introduced.
- Package scripts and dev dependencies may change to support tests.
- TypeScript and Vite configuration may change to support stable import aliases.
- No intentional backend Rust API changes are included in this refactor.
