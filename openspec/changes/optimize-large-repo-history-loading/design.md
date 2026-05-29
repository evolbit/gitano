## Context

Opening a repository mounts the normal workspace and immediately loads the commit list. The frontend call is asynchronous, but the Rust command behind `get_commits_list_paginated` is synchronous and performs all expensive work before it returns: it runs `git log`, parses every row, computes graph metadata, stores the full vector in a mutex-protected cache, clones the cached vector, slices it, and sends the result back to the webview.

The current API is paginated only at the final slice step. For kernel-scale repositories, that means the app can wait on more than one million commit rows and graph segments before the first visible row is available. Exploration against a local Linux checkout showed about 1.45 million reachable commits; the current all-refs log command took roughly 13 seconds before Rust parsing, graph construction, JSON serialization, and React state work. The `%D` decoration field was especially expensive: loading 2,000 rows with `%D` took several seconds, while a similar command without decoration was effectively instant.

Virtualizing the table protects the DOM from rendering every row, but it does not protect the IPC payload, frontend deserialization, React state size, row mapping, or client-side search scan. To keep the app responsive, the backend should own the full history/cache and expose bounded views plus full-history search.

## Goals / Non-Goals

**Goals:**

- Keep the repository workspace responsive while full commit history and graph data is prepared.
- Allow the graph to be computed as a complete backend job rather than forcing unreliable chunked graph construction.
- Keep full commit history and graph data in a backend cache and return bounded windows/pages to the frontend.
- Preserve visible commit list behavior, including loading, virtualization, row selection, keyboard navigation, and commit details.
- Move full-history commit search to the backend cache so search does not require all commits in JavaScript.
- Avoid holding global cache locks while expensive Git or graph work is running.
- Keep command payloads typed and mockable through existing `src/shared/api/git` adapters.

**Non-Goals:**

- Replacing the current visual graph algorithm.
- Streaming partial graph rows while the graph is still being computed.
- Redesigning the commit list UI.
- Optimizing working tree status/diff hunk loading or recursive watcher setup, except where those paths need to coexist with the new history loading model.
- Supporting multiple persistent on-disk history caches across app restarts.

## Decisions

### Run full history builds as backend jobs

Introduce a backend history job/cache boundary for commit history. The frontend can request history preparation for a repository/history mode, receive a loading state, and later request bounded rows when preparation completes. The expensive work should run as an async Tauri command with blocking Git/CPU work moved to a blocking task or worker thread.

Alternative considered: make the existing `get_commits_list_paginated` command `async` and keep returning the same page shape. That would reduce main-thread blocking but would still compute and serialize through the same all-at-once command path. A job boundary makes readiness, cancellation, cache reuse, and search explicit.

### Keep full graph data in Rust and return bounded row windows

The backend cache should store the full computed commit rows, including graph metadata. The frontend should request a bounded window/page, for example the first several thousand rows or a window around a selected/search result row. The exact page size can be tuned during implementation, but it should be a named constant rather than using the current 100,000 row limit.

Alternative considered: send the full graph to the frontend once it is ready and rely on virtualization. This protects DOM rendering but still risks large IPC payloads, deserialization stalls, memory growth, React state churn, and expensive client-side search for very large histories.

### Move commit search to the backend cache

Search should run against backend cached metadata for the full prepared history. The frontend should send the normalized query and receive enough structured data to preserve the current UX: match count, current match position, target row index or commit SHA for next/previous navigation, and a bounded row window when a match is outside the currently loaded rows.

Alternative considered: search only the loaded frontend window. That would be fast but misleading because it would not search all commits. Another alternative is sending a lightweight all-commit search index to the frontend; this still creates a large IPC/state payload and duplicates backend data.

### Remove ref decoration from the hot log path

The current `%D` field in the `git log` format is a major large-repo cost. The primary history scan should avoid `%D` and build ref labels separately from a lightweight ref query, then annotate only rows that appear in the backend cache/window. This keeps branch/tag labels without forcing Git decoration work into every logged row.

Alternative considered: keep `%D` and rely on the background job. That would make the app responsive but leaves large repositories slower than necessary and increases the chance that history preparation takes long enough to feel broken.

### Use per-repository and per-history-mode cache entries

The cache key should include repository path and history mode. It should also account for invalidation inputs such as current `HEAD`, refs, and explicit force refresh. Cache entries need explicit states such as `idle`, `loading`, `ready`, and `error`, so the frontend can render deterministic loading and retry states.

Alternative considered: one global cache vector guarded by a mutex. That is close to the current model and risks blocking unrelated requests while a large history is built.

### Keep the frontend table virtualized but treat virtualization as rendering-only

The frontend should continue using the virtualized table for visible row rendering. It should no longer depend on having the entire history array in React state for search or navigation. Selection should be keyed by commit SHA and row index metadata from the backend so the UI can request the correct row window when needed.

Alternative considered: replace the table virtualization model. That is unnecessary if payload and state size are bounded.

### Materialize graph drawing segments per row window

The backend should preserve the complete graph lane model as compact line intervals, then expand those intervals into `CommitGraphSegment` values only for rows returned by `get_commit_history_window`. This matches the reference architecture more closely: the expensive graph state is prepared once, while viewport-sized drawing primitives are derived for visible rows.

The frontend rendering contract should not change. Each returned commit row still includes `graph_width`, `graph_lane`, `graph_color`, and `graph_segments`; only the timing of segment creation changes. Window expansion must include graph lines whose intervals start before the requested window and continue into it, otherwise long vertical branch lines and merge lines would disappear at page boundaries.

### Keep scroll position absolute while row data is windowed

The commit table should virtualize over the backend `total_count`, not over only the currently loaded rows. Loaded rows are positioned by their full-history row offset, and unloaded rows act as temporary placeholders until a bounded backend window around the visible range is fetched. This preserves normal scrollbar behavior while still keeping React state bounded to the active backend window.

### Decouple graph viewport data from commit row details

The graph column should stay in the table and remain resizable, but graph data should be loadable independently from full commit row details. The backend exposes a graph-only bounded window with row index, lane/color metadata, and row-local graph segments. The frontend keeps this graph window separate from the commit-detail window so unloaded commit rows can render graph cells and `Loading...` text placeholders during fast scrollbar movement.

This preserves bounded IPC/state while avoiding blank table rows after large jumps. Full commit details still load through `get_commit_history_window`; graph-only windows are smaller and can be requested with a tighter viewport-sized range.

### Cap the physical scroll canvas for huge histories

Virtualization controls how many DOM rows render, but the browser still needs a physical scroll canvas to represent `total_count * row_height`. Kernel-scale histories can exceed practical browser scroll-height limits or precision, especially when dragging the native scrollbar near the end. The table should cap the physical canvas height and map that compressed scroll range back to full-history row indexes.

This keeps the scrollbar able to reach the first commit while preserving fixed row heights and the existing row-window API. Visible-range callbacks should continue to report absolute full-history row indexes so graph-only and commit-detail windows can be fetched normally.

### Keep recently loaded detail rows stable

The frontend should keep a bounded cache of recently fetched commit-detail rows keyed by absolute full-history row index. This cache is separate from the active backend window and lets nearby scrolling reuse already-loaded commit text instead of falling back to placeholders whenever the active window shifts.

Rendered virtual rows should be keyed by absolute row index, not by the current row payload. That keeps a row mounted when it transitions from placeholder data to commit detail data and avoids remount-driven flicker during fast scroll updates.

### Suppress stale viewport responses

Fast scrollbar movement can schedule several commit-detail and graph-only window requests before earlier requests finish. The frontend should treat each request class as latest-wins: older responses may complete successfully, but they must not replace the currently visible commit window, graph window, search result, or error state after a newer request has started.

This avoids visible row content jumping back to an older viewport when backend responses complete out of order.

## Risks / Trade-offs

- Backend job completes but result serialization still stalls for large pages -> Keep row windows bounded and tune page/window size with measured payload sizes.
- Full graph build still takes many seconds for kernel-scale repositories -> Show explicit loading/progress text for history preparation and keep the rest of the workspace responsive.
- Search before history cache is ready becomes ambiguous -> Return a loading/search-unavailable state until the cache is ready, or attach search to the same preparation lifecycle.
- Cache invalidation can return stale history after branch or ref changes -> Tie invalidation to repo realtime events and force refresh paths; include repository state/ref signatures in cache entries where useful.
- Multiple tabs for the same repository can duplicate work -> Share backend jobs by repository path/history mode and let concurrent frontend callers observe the same cache entry.
- Memory pressure can grow if several huge repositories are open -> Add bounded cache eviction or clear cache entries when repo tabs close or force-refresh replaces them.
- Backend search can be slow for very broad queries -> Debounce frontend queries and search lightweight normalized metadata fields, not graph segment payloads.

## Migration Plan

1. Introduce backend history cache/job types and a small API surface for prepare, status/page, and search.
2. Adapt the existing commit list frontend adapter and hook to the new lifecycle while preserving the current UI states.
3. Keep the old command path temporarily where tests or other callers still rely on it, or replace it behind the same adapter once parity is covered.
4. Add cache invalidation for commit/ref refresh events and force refresh.
5. Remove or lower the current frontend `FULL_LOG_COMMIT_LIMIT` once bounded backend windows are active.
6. Roll back by routing the adapter back to the existing paginated command if the job/cache lifecycle causes regressions.

## Open Questions

- What should the default row window size be for the first ready response: 2,000, 5,000, or 10,000 rows?
- Should the UI expose a distinct "preparing graph" message, or reuse the existing commit list loading state?
- Should cache eviction be tied only to tab closure, or should it also enforce a global memory budget?
- Should backend search return all match indices for small result sets and only next/previous cursors for large result sets?
