## 1. Backend Branch Commands

- [x] 1.1 Add Rust command support for checkout from a remote branch ref, creating a local tracking branch when needed and checking out an existing local counterpart when present.
- [x] 1.2 Add Rust command support for merging a validated remote branch ref into the current local branch.
- [x] 1.3 Add Rust command support for rebasing the current local branch onto a validated remote branch ref.
- [x] 1.4 Add Rust command support for deleting a branch from `origin` via remote delete.
- [x] 1.5 Register new commands with Tauri and add Rust unit tests for checkout, merge, rebase, remote delete, validation errors, and detached/unborn edge cases.

## 2. Frontend Adapters And Utilities

- [x] 2.1 Add typed branch API adapter functions and command names for remote checkout, remote merge, remote rebase, and remote delete.
- [x] 2.2 Add or promote provider URL helpers for branch URLs and reuse commit URL helpers for remote branch tip commit links.
- [x] 2.3 Add adapter and URL utility tests covering command payloads, GitHub/GitLab/Bitbucket-style branch URLs, slash branch names, and unsupported remote URLs.

## 3. Branch Context Menu UI

- [x] 3.1 Update branch context menu target derivation so local, both-present, and remote-only rows expose the correct local branch name, remote ref name, and remote logical branch name.
- [x] 3.2 Add remote branch menu items for checkout, create worktree, create branch, merge into current branch, rebase current branch onto remote branch, delete remote branch, and copy provider URLs.
- [x] 3.3 Keep cherry-pick, create tag, and reset actions out of remote branch menus.
- [x] 3.4 Add remote branch delete confirmation copy and route confirmed deletes to the remote delete command.
- [x] 3.5 Add conditional matching pull request menu actions only when existing integration data can resolve an open pull request for the selected remote branch.
- [x] 3.6 Update branch context menu component tests for remote-only rows, both-present rows, disabled no-current-branch states, PR conditional rendering, delete confirmation, and copy link actions.

## 4. Branch Row Activation

- [x] 4.1 Update branch tree double-click handling so remote rows run the same checkout path as the remote checkout menu action.
- [x] 4.2 Preserve group row double-click behavior so groups do not run checkout.
- [x] 4.3 Update branch tree and branch-list behavior tests for local row checkout, remote-only row tracking checkout, both-present row local checkout, and group rows.

## 5. Refresh And Feedback

- [x] 5.1 Route remote branch checkout, merge, rebase, and delete through the shared git-action loading and notice patterns.
- [x] 5.2 Refresh repository refs and commit history after remote branch actions succeed or fail where repository state may have changed.
- [x] 5.3 Add tests proving notices, selected branch/tab state, and refresh events update after remote branch actions.

## 6. Verification

- [x] 6.1 Run focused frontend tests for branches components, hooks, adapters, and URL utilities.
- [x] 6.2 Run focused Rust tests for branch commands.
- [x] 6.3 Run `pnpm run lint`, `pnpm test`, and `pnpm run build`.
- [x] 6.4 Run `cargo test` from `src-tauri`.
- [x] 6.5 Run OpenSpec validation/status checks for `improve-remote-branch-actions`.
