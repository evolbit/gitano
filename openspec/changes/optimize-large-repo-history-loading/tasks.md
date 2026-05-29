## 1. Backend History Cache

- [x] 1.1 Define backend request/response types for history preparation status, bounded row windows, and search results.
- [x] 1.2 Add a repository/history-mode keyed history cache with explicit `idle`, `loading`, `ready`, and `error` states.
- [x] 1.3 Move expensive Git log parsing and graph construction out of the synchronous command path into an async/background job.
- [x] 1.4 Ensure the cache lock is not held while running Git commands, parsing commit rows, or building graph metadata.
- [x] 1.5 Share an in-flight preparation job when multiple callers request the same repository and history mode.
- [x] 1.6 Add cache invalidation and force-refresh behavior for repository commit/ref refresh inputs.

## 2. Backend History Data

- [x] 2.1 Replace the hot-path `%D` decoration scan with a lightweight ref-label collection strategy.
- [x] 2.2 Annotate prepared commit rows with branch/tag labels from the backend ref map.
- [x] 2.3 Implement bounded row-window retrieval from a ready cache entry.
- [x] 2.4 Implement row-window retrieval around a commit SHA or full-history row index.
- [x] 2.5 Implement backend full-history search over lightweight commit metadata.
- [x] 2.6 Implement next/previous search-match navigation that returns commit SHA and full-history row index.

## 3. Frontend Adapter And State

- [x] 3.1 Add typed frontend API adapter functions for preparing history, polling/readiness, loading row windows, and searching.
- [x] 3.2 Update commit list data loading to show loading while backend history preparation is in progress.
- [x] 3.3 Store only bounded commit windows in React state instead of the full prepared history.
- [x] 3.4 Preserve selected commit state by SHA and keep commit detail loading behavior unchanged.
- [x] 3.5 Replace client-only commit search with backend-backed full-history search.
- [x] 3.6 Update next/previous search navigation to load a row window around off-window matches before selecting them.

## 4. UI Behavior

- [x] 4.1 Keep the existing virtualized commit table rendering for loaded windows.
- [x] 4.2 Preserve keyboard navigation inside the currently loaded row window.
- [x] 4.3 Add window-boundary handling for keyboard or search navigation that targets rows outside the loaded window.
- [x] 4.4 Preserve existing empty, error, and initial-commit states in the commit list.
- [x] 4.5 Replace the current `FULL_LOG_COMMIT_LIMIT` behavior with a named bounded window-size constant.

## 5. Tests And Verification

- [x] 5.1 Add Rust unit tests for cache state transitions, cache sharing, bounded window slicing, and invalidation.
- [x] 5.2 Add Rust unit tests for backend search matching and next/previous match navigation.
- [x] 5.3 Add frontend adapter tests for the new command payloads and response handling.
- [x] 5.4 Add commit list hook/component tests for loading, bounded rows, search count display, off-window match navigation, and retry after error.
- [x] 5.5 Run `cargo test` from `src-tauri`.
- [x] 5.6 Run `pnpm run lint`.
- [x] 5.7 Run `pnpm test`.
- [x] 5.8 Run `pnpm run build`.

## 6. Large Repository Smoke Check

- [ ] 6.1 Measure opening the local Linux checkout before and after the change using the same machine.
- [ ] 6.2 Confirm the app remains responsive while history preparation is loading.
- [ ] 6.3 Confirm the commit list appears after preparation and only bounded row windows are sent to the frontend.
- [ ] 6.4 Confirm full-history search can find matches outside the initially loaded row window.

CLI timing note: `/Users/marco/repositories/linux` has 1,446,276 reachable commits. The legacy decorated full-history log format measured `real 8.49s`; the current undecorated full-history log format measured between `real 8.42s` and `real 11.97s` during repeated runs, and separate ref-map collection measured `real 0.04s`. These command timings are noisy and do not substitute for the desktop responsiveness smoke check above; the main UI fix is async background preparation plus bounded IPC payloads.

## 7. Lazy Graph Segment Materialization

- [x] 7.1 Store prepared graph lines as compact intervals in the backend history cache instead of precomputing per-row graph segments for every commit.
- [x] 7.2 Expand graph line intervals into `CommitGraphSegment` values only for bounded row windows returned to the frontend.
- [x] 7.3 Include graph lines that start before a requested window and continue through it so visual continuity is preserved at window boundaries.
- [x] 7.4 Keep the existing frontend graph row contract unchanged.
- [x] 7.5 Preserve the legacy paginated command behavior for any remaining callers.
- [x] 7.6 Add Rust tests for window-local graph segment expansion across long straight lines and merge/checkout boundaries.
- [x] 7.7 Run focused backend/frontend checks for the lazy graph segment path.

## 8. Scroll Window Navigation

- [x] 8.1 Load the next commit history window when the user scrolls near the bottom of the currently loaded window.
- [x] 8.2 Load the previous commit history window when the user scrolls near the top of a non-initial window.
- [x] 8.3 Preserve a useful scroll position after replacing the loaded window so scrolling can continue across backend windows.
- [x] 8.4 Add component coverage for scroll-driven window loading.
- [x] 8.5 Virtualize the table against the full backend row count while positioning loaded rows by full-history offset.
- [x] 8.6 Debounce visible-range backend window requests and throttle scroll-position reporting during fast scrollbar drags.

## 9. Graph-Only Viewport Windows

- [x] 9.1 Add backend graph-only row/window response types and a Tauri command for bounded graph viewport data.
- [x] 9.2 Add a typed frontend adapter and hook state for graph-only windows.
- [x] 9.3 Render graph-backed placeholder rows with `Loading...` commit text while full commit details are not loaded.
- [x] 9.4 Keep the graph as the existing resizable table column.
- [x] 9.5 Add focused tests for graph-only adapter/hook behavior and fast-scroll placeholder behavior.

## 10. Huge History Scroll Range

- [x] 10.1 Cap the table's physical scroll canvas for histories whose full row height exceeds browser scroll-height limits.
- [x] 10.2 Map compressed scrollbar positions back to absolute full-history row indexes for visible-range loading.
- [x] 10.3 Disable legacy append-mode scroll restoration for the windowed commit table path.
- [x] 10.4 Add table coverage proving a very large row count can render the final rows.
- [x] 10.5 Cache recently fetched commit-detail rows by absolute row index so nearby scrolling does not revert loaded rows to placeholders.
- [x] 10.6 Key rendered virtual rows by absolute row index to avoid remounting rows when detail data replaces placeholders.
- [x] 10.7 Suppress stale commit-detail, graph-only, and search responses when newer viewport requests are in flight.
