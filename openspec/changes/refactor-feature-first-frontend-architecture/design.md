## Context

Gitano is a Tauri + React + TypeScript desktop app. The current frontend is organized mostly by technical buckets: `components`, `hooks`, `store`, `types`, `utils`, and `constants`. Some areas already behave like features (`branch-list`, `changes-explorer`, `diff-viewer`), but shared code and platform calls are still mixed into component folders and top-level utility buckets.

The refactor must preserve the current Git workflows, persisted state shape, visual layout, and Rust command contracts. The existing OpenSpec requirements around component folders, changes explorer structure, shared tree/path utilities, realtime events, workspace UI persistence, and diff behavior remain constraints.

## Goals / Non-Goals

**Goals:**

- Make ownership visible from paths: feature code lives under `src/features/<feature>`, reusable code lives under `src/shared`, and app composition lives under `src/app`.
- Keep feature modules internally understandable by grouping their components, hooks, stores, types, API adapters, and tests together.
- Move direct Tauri and Git command access into typed platform/API modules so render components stay focused on UI and orchestration.
- Add test infrastructure and focused tests around pure utilities, stores, hooks, and high-risk feature flows.
- Migrate incrementally with compatibility exports where they reduce churn and keep each step buildable.

**Non-Goals:**

- Rewriting the Rust backend or changing Tauri command names.
- Redesigning the UI or changing product behavior.
- Replacing Zustand, Mantine, Tailwind, or the current Vite/Tauri stack.
- Moving every file in a single commit.

## Decisions

1. Use a three-layer frontend shape: `app`, `features`, and `shared`.

   `src/app` owns bootstrap, providers, app shell composition, routing/tab orchestration, and global startup effects. `src/features` owns Gitano workflows such as repository tabs, branches, changes, commits, diffs, stashes, worktrees, tags, launchpad, and commit creation. `src/shared` owns reusable UI primitives, generic hooks, platform adapters, constants, and pure utilities.

   Alternative considered: keep the current technical buckets and only add subfolders. That would be lower churn initially, but it keeps feature ownership implicit and continues to spread a workflow across many top-level folders.

2. Prefer feature-local colocated modules over global buckets.

   Feature modules may contain `components`, `hooks`, `stores`, `types`, `api`, `utils`, and `__tests__` when those files are owned by the feature. Shared modules are promoted only when multiple features need the same behavior or when the module is truly platform/application infrastructure.

   Alternative considered: create global `components`, `hooks`, `stores`, and `types` inside every layer. That preserves the problem in a different location and makes ownership harder to infer.

3. Introduce typed platform adapters before broad component moves.

   Direct Tauri imports and `core.invoke`/`invoke` calls should move behind small typed functions in `shared/platform` or feature API modules. Backend command names stay centralized, request/response types remain explicit, and components call domain functions instead of raw command strings.

   Alternative considered: keep direct invocations inside components and only move files. That improves folder appearance without reducing coupling or test difficulty.

4. Use compatibility exports during migration.

   Existing imports may continue through transitional barrel files or re-export modules while feature folders are introduced. New code should import from the target architecture path. Compatibility exports should be deleted once consumers have moved.

   Alternative considered: update every import at once. That maximizes churn and makes regressions harder to isolate.

5. Test pure logic first, then feature behavior.

   The first test layer should cover pure path/tree utilities, staged selection helpers, store reducers/actions, and platform adapter mocks. Component tests should focus on behavior that users can observe, especially staging, file selection, branch/worktree operations, and diff mode interactions.

   Alternative considered: start with broad end-to-end tests. E2E coverage is valuable later, but unit and focused integration tests make the refactor safer and faster to iterate.

6. Use import aliases for architecture boundaries.

   Add aliases such as `@/app`, `@/features`, and `@/shared` once the folders exist. Relative imports remain acceptable within a local feature subtree, but cross-layer imports should use aliases for readability.

   Alternative considered: keep deep relative imports everywhere. That works technically but makes moved files fragile and obscures layer direction.

## Risks / Trade-offs

- Large import churn can hide behavior regressions -> migrate one feature slice at a time and run build/tests after each slice.
- Compatibility exports can become permanent -> track removal tasks explicitly and keep new code on target paths.
- Feature boundaries may be ambiguous for shared Git concepts -> start with current workflow ownership and promote only proven shared code.
- Test dependencies add maintenance cost -> keep the test stack minimal and focused on refactor safety.
- Platform adapters can become a generic dumping ground -> keep adapters small, typed, and grouped by platform/domain command surface.

## Migration Plan

1. Add test tooling, import aliases, and empty target architecture folders.
2. Move generic pure utilities, constants, and design primitives into `shared` with compatibility exports.
3. Add typed platform adapters for storage, dialogs, events, window persistence, and Git command groups.
4. Migrate one feature at a time, starting with lower-risk domains and then the heavier repository workspace flows.
5. Add tests alongside each migrated utility, store, hook, or behavior.
6. Remove compatibility exports and legacy top-level buckets after all consumers have moved.

Rollback is per-slice: revert the most recent feature migration while keeping earlier slices intact. Backend commands and persisted state keys must remain stable throughout the migration.

## Open Questions

- Whether to enforce layer rules with lint tooling now or after the first few migrations prove the final boundaries.
- Whether broad browser/e2e coverage should be added in this change or handled as a follow-up once the feature layout is stable.
