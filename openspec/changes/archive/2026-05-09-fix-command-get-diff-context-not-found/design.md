## Context

The diff viewer expands additional context lines by invoking a Tauri command named `get_diff_context`. The backend implementation exists, but the exported command name is `get_diff_context_command`, so Tauri never resolves the frontend request.

## Goals

- Make diff-context expansion work without changing the request payload shape used by the frontend.
- Keep the fix minimal and local to the command boundary.
- Add a clear contract so command naming stays stable.

## Non-Goals

- Changing diff-context generation logic
- Redesigning the diff viewer UI
- Renaming unrelated Tauri commands

## Design

The backend command name should match the frontend invoke name directly. The simplest fix is to expose the Tauri command as `get_diff_context` instead of `get_diff_context_command` and update the invoke handler registration accordingly.

This keeps:

- the existing Rust diff implementation
- the current frontend `invoke("get_diff_context", ...)` call
- the request and response types already used by the diff viewer

## Verification

- Expanding diff context from the diff viewer should no longer raise a command-not-found error.
- `cargo check` should pass after the command rename.
- Frontend build behavior should not regress because the invoke call site remains unchanged.
