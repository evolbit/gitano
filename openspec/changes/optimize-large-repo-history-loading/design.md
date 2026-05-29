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
