## Why

Gitano currently feels responsive for regular repositories, but opening very large repositories such as the Linux kernel can make the app appear hung. The commit history command is named paginated, but it still builds the full commit list and graph before returning, which blocks the desktop event loop and sends more data to the frontend than virtualization can safely absorb.

## What Changes

- Move large commit history and graph loading off the blocking Tauri command path so the workspace can show a loading state while the full history graph is prepared.
- Keep the full commit history and graph cache in the Rust backend for large repositories instead of always sending the entire dataset to the webview.
- Return bounded commit-list windows/pages to the frontend after the backend history cache is ready.
- Move full-history commit search to the backend cache so search works across all commits without requiring every commit row to live in JavaScript state.
- Preserve the existing commit list interactions: loading state, virtualization, selection, keyboard navigation, next/previous search match navigation, and commit detail loading.
- Avoid changing the visual commit graph model in this change; the graph may still be computed as a whole if chunked graph construction is not reliable.

## Capabilities

### New Capabilities

- `large-repo-history-loading`: Defines responsive commit history loading, backend history/graph caching, bounded frontend payloads, and backend-backed commit search for large repositories.

### Modified Capabilities

- None.

## Impact

- Backend commit history commands in `src-tauri/src/git/commits`.
- Tauri command execution model for commit history loading.
- Frontend commit history API adapters in `src/shared/api/git/commits.ts`.
- Commit list data loading, search, and navigation hooks/components in `src/features/history`.
- Tests for Rust commit history caching/search and frontend commit list loading/search behavior.
- No dependency changes are expected.
