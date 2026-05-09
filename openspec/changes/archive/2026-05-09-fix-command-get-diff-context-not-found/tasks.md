## 1. Command Contract Fix

- [x] 1.1 Update the exported Tauri command in `src-tauri/src/git/commands.rs` so the diff-context command is exposed as `get_diff_context`.
- [x] 1.2 Update `src-tauri/src/main.rs` to register the renamed diff-context command in the invoke handler.

## 2. Verification

- [x] 2.1 Verify the frontend diff viewer still invokes `get_diff_context` without code changes to the request payload.
- [x] 2.2 Run `cargo check` in `src-tauri/` to confirm the command rename compiles cleanly.
