## Why

Remote branch rows currently expose fewer useful actions than local rows, even though they are common starting points for checkout, review, merge, rebase, and cleanup workflows. The menu should make remote branch intent explicit while avoiding commit-tip actions that would make the branch panel feel like a commit graph menu.

## What Changes

- Add a remote-branch context menu shape focused on branch workflows: checkout, create worktree, create branch, merge/rebase into the current branch, compare, optional matching pull request actions, remote delete, and copy/link actions.
- Add double-click checkout for branch rows, including remote rows.
- Make remote checkout create or switch to a local tracking branch instead of detaching `HEAD` at `origin/<branch>`.
- Keep cherry-pick, create tag, and reset commit actions out of the remote branch menu for now.
- Keep pull request actions conditional: show them only when Gitano can resolve a matching open pull request for the remote branch.
- Add copy branch URL and copy remote commit URL actions when the origin remote URL can be converted to a web URL.

## Capabilities

### New Capabilities

- `remote-branch-context-actions`: Remote branch row menu, activation, checkout, branch operation, delete, and remote-link behavior.

### Modified Capabilities

- `branch-comparison-review`: Remote branch rows continue to open directional comparison using explicit current-vs-selected branch labels.

## Impact

- Branches panel components, hooks, menu state, double-click row behavior, and colocated tests in `src/features/branches`.
- Typed branch adapters in `src/shared/api/git/branches.ts` and related adapter tests.
- Remote URL helpers in `src/shared/lib/git` or branch-owned utilities for branch and commit URL generation.
- Rust/Tauri Git branch commands in `src-tauri/src/git/staging/branches.rs` and command registration.
- GitHub pull request integration usage only if matching branch metadata can be resolved through existing integration APIs without broad new provider behavior.
