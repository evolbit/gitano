## Why

Current Changes still performs full diff work for every changed file before the sidebar can settle. Large working trees or generated files can make refreshes expensive, increase payload size, and cause avoidable React work even when the user only needs the file list or a single selected diff.

This change makes Current Changes load in the same spirit as the optimized commit list: fetch the minimum data needed for the visible workflow first, then load heavier details only when the user asks for them.

## What Changes

- Introduce a lightweight Current Changes summary flow for file path, status, counts, and staged file-level state.
- Load full working-tree diff hunks lazily for selected or opened files instead of embedding hunks for every changed file in the initial changes response.
- Preserve immediate index staging and external index synchronization while moving expensive staged-line detail work to targeted file-level requests.
- Coalesce overlapping Current Changes refreshes and ignore stale responses so bursty realtime events or staging actions do not apply old snapshots.
- Add batch-oriented backend support for multi-file staging operations used by folders and bulk selections where it reduces repeated command invocations.
- Keep the explorer and diff surfaces responsive for large changed-file sets and large selected diffs, with virtualization or bounded rendering where needed.

## Capabilities

### New Capabilities
- `current-changes-loading-performance`: Defines summary-first Current Changes loading, lazy diff detail loading, refresh coalescing, and bounded rendering/mutation work for large working trees.

### Modified Capabilities
- `changes-explorer-refresh-responsiveness`: Clarifies that unchanged or coalesced refreshes must avoid redundant backend work and stale response application.
- `external-index-staging-sync`: Clarifies that external staged state remains synchronized when staged-line detail is loaded lazily.
- `immediate-index-staging`: Clarifies that optimized batch and lazy-loading paths must preserve immediate Git index staging semantics.
- `working-tree-diff-modal`: Clarifies that the inline working diff may load its hunks independently from the sidebar summary while preserving live selected-file updates.

## Impact

- Frontend adapters under `src/shared/api/git` will need typed summary and file-detail contracts.
- Current Changes hooks and stores under `src/features/working-changes` will need summary/detail state separation, request coalescing, and stale-response protection.
- Diff state under `src/features/diffs` and repo workspace composition under `src/features/repository-workspace` will need to load selected working-file hunks through the new detail flow.
- Tauri Git commands under `src-tauri/src/git/staging` and `src-tauri/src/git/diff` will need summary-first and targeted/batched diff operations.
- Tests should cover backend parsing, frontend adapters, request lifecycle behavior, staged-state sync, and large-list or large-diff rendering boundaries.
