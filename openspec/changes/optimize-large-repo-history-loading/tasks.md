## 1. Backend History Cache

- [ ] 1.1 Define backend request/response types for history preparation status, bounded row windows, and search results.
- [ ] 1.2 Add a repository/history-mode keyed history cache with explicit `idle`, `loading`, `ready`, and `error` states.
- [ ] 1.3 Move expensive Git log parsing and graph construction out of the synchronous command path into an async/background job.
- [ ] 1.4 Ensure the cache lock is not held while running Git commands, parsing commit rows, or building graph metadata.
- [ ] 1.5 Share an in-flight preparation job when multiple callers request the same repository and history mode.
- [ ] 1.6 Add cache invalidation and force-refresh behavior for repository commit/ref refresh inputs.

## 2. Backend History Data

- [ ] 2.1 Replace the hot-path `%D` decoration scan with a lightweight ref-label collection strategy.
- [ ] 2.2 Annotate prepared commit rows with branch/tag labels from the backend ref map.
- [ ] 2.3 Implement bounded row-window retrieval from a ready cache entry.
- [ ] 2.4 Implement row-window retrieval around a commit SHA or full-history row index.
- [ ] 2.5 Implement backend full-history search over lightweight commit metadata.
- [ ] 2.6 Implement next/previous search-match navigation that returns commit SHA and full-history row index.

## 3. Frontend Adapter And State

- [ ] 3.1 Add typed frontend API adapter functions for preparing history, polling/readiness, loading row windows, and searching.
- [ ] 3.2 Update commit list data loading to show loading while backend history preparation is in progress.
- [ ] 3.3 Store only bounded commit windows in React state instead of the full prepared history.
- [ ] 3.4 Preserve selected commit state by SHA and keep commit detail loading behavior unchanged.
- [ ] 3.5 Replace client-only commit search with backend-backed full-history search.
- [ ] 3.6 Update next/previous search navigation to load a row window around off-window matches before selecting them.

## 4. UI Behavior

- [ ] 4.1 Keep the existing virtualized commit table rendering for loaded windows.
- [ ] 4.2 Preserve keyboard navigation inside the currently loaded row window.
- [ ] 4.3 Add window-boundary handling for keyboard or search navigation that targets rows outside the loaded window.
- [ ] 4.4 Preserve existing empty, error, and initial-commit states in the commit list.
- [ ] 4.5 Replace the current `FULL_LOG_COMMIT_LIMIT` behavior with a named bounded window-size constant.

## 5. Tests And Verification

- [ ] 5.1 Add Rust unit tests for cache state transitions, cache sharing, bounded window slicing, and invalidation.
- [ ] 5.2 Add Rust unit tests for backend search matching and next/previous match navigation.
- [ ] 5.3 Add frontend adapter tests for the new command payloads and response handling.
- [ ] 5.4 Add commit list hook/component tests for loading, bounded rows, search count display, off-window match navigation, and retry after error.
- [ ] 5.5 Run `cargo test` from `src-tauri`.
- [ ] 5.6 Run `pnpm run lint`.
- [ ] 5.7 Run `pnpm test`.
- [ ] 5.8 Run `pnpm run build`.

## 6. Large Repository Smoke Check

- [ ] 6.1 Measure opening the local Linux checkout before and after the change using the same machine.
- [ ] 6.2 Confirm the app remains responsive while history preparation is loading.
- [ ] 6.3 Confirm the commit list appears after preparation and only bounded row windows are sent to the frontend.
- [ ] 6.4 Confirm full-history search can find matches outside the initially loaded row window.
