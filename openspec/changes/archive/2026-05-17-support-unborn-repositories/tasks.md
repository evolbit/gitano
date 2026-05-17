## 1. Backend Repository State

- [x] 1.1 Add Rust helpers and types for resolving repository head state, including unborn branch, normal branch, detached head, and invalid path cases.
- [x] 1.2 Update `open_local_repo` or add a typed repository-state command so the frontend can distinguish valid unborn repositories from invalid folders.
- [x] 1.3 Update current branch resolution so an unborn symbolic branch returns its branch name instead of a backend error.
- [x] 1.4 Add Rust tests for normal, detached, invalid, and freshly initialized unborn repositories.

## 2. Backend Command Behavior

- [x] 2.1 Make commit history return an empty page for unborn repositories instead of running `git log HEAD`.
- [x] 2.2 Make working and staged diff paths handle staged files before the first commit, using an empty-tree baseline where needed.
- [x] 2.3 Verify stage, unstage, stage all, unstage all, and commit can complete a first-commit workflow.
- [x] 2.4 Guard backend commands that require an existing commit with clear errors instead of raw `HEAD` failures.

## 3. Shared Frontend API

- [x] 3.1 Add TypeScript repository-state types and typed adapter functions in `src/shared/api`.
- [x] 3.2 Update existing branch/current repository adapters to preserve command payload testability.
- [x] 3.3 Add adapter tests for unborn repository state payloads and command names.
- [x] 3.4 Add a typed adapter for initializing a local repository from a selected folder.

## 4. Workspace UI

- [x] 4.1 Update launchpad recent/favorite rows so unborn repositories are shown as valid entries with a no-commits indicator.
- [x] 4.2 Update the history pane to show a first-commit empty state when the active repository is unborn.
- [x] 4.3 Keep the working changes and commit bar usable for staging and creating the first commit.
- [x] 4.4 Disable or guard toolbar, branch, tag, worktree, compare, amend, cherry-pick, revert, pull, push, and stash actions that require an existing commit.
- [x] 4.5 Add concise explanatory labels or tooltips for disabled unborn-repository actions.
- [x] 4.6 Add a launchpad action for creating a new local repository.

## 5. Refresh And Persistence

- [x] 5.1 Refresh repository state, refs, history, and working changes after a successful first commit.
- [x] 5.2 Ensure repository realtime watchers tolerate unborn repositories without repeated errors.
- [x] 5.3 Ensure recent repos and open tabs persist unborn repositories the same way as normal repositories.
- [x] 5.4 Ensure newly initialized repositories are added to recents and opened immediately.

## 6. Verification

- [x] 6.1 Add frontend tests for opening an unborn repo from launchpad and rendering the workspace empty states.
- [x] 6.2 Add frontend tests that commit-dependent actions are disabled or guarded while first-commit actions remain available.
- [x] 6.3 Add integration or Rust tests for first commit transition from unborn to normal repository state.
- [x] 6.4 Add backend tests for initializing a local repository.
- [x] 6.5 Add frontend tests for the launchpad create-repository flow.
- [x] 6.6 Run the relevant Rust tests.
- [x] 6.7 Run the frontend test suite.
- [x] 6.8 Run the frontend build.
