## Why

Expanding diff context currently fails because the frontend invokes `get_diff_context` while the Tauri backend only exposes `get_diff_context_command`. That breaks a core diff workflow and surfaces a command-not-found error in normal use.

## What Changes

- Align the Tauri command name for diff-context loading with the frontend invoke contract.
- Preserve the existing diff-context request parameters and response shape.
- Add spec coverage for the diff-context command path so future renames do not silently break the UI.

## Capabilities

### New Capabilities
- `diff-context-loading`: Defines the frontend-to-Tauri contract for loading additional diff context around a hunk.

### Modified Capabilities

## Impact

- Affected code in `src/components/DiffViewer.tsx`, `src-tauri/src/git/commands.rs`, and `src-tauri/src/main.rs`
- Tauri invoke command registration and frontend diff expansion behavior
