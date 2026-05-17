## 1. Branch Menu Cleanup

- [x] 1.1 Remove `Cherry pick commit`, `Reset ... to this commit`, and `Revert commit` from the branch context menu branching section
- [x] 1.2 Update branch context-menu tests or add coverage proving those commit-only placeholders are absent

## 2. Backend Git Commands

- [x] 2.1 Add a command to generate a Git patch for a commit against its first parent
- [x] 2.2 Add a command to cherry-pick a commit onto the current branch
- [x] 2.3 Add a command to revert a commit on the current branch
- [x] 2.4 Add or extend diff commands to compare a commit tree against the current working tree state
- [x] 2.5 Register new Tauri commands and add frontend API wrappers with payload tests
- [x] 2.6 Add backend tests for successful commands, missing commit refs, and Git failure propagation where feasible

## 3. Shared URL And Opener Utilities

- [x] 3.1 Add a remote commit URL builder that normalizes HTTPS and SSH origin URLs
- [x] 3.2 Support GitHub/generic, GitLab, and Bitbucket commit URL shapes
- [x] 3.3 Expose an `openUrl` platform helper through the Tauri opener adapter
- [x] 3.4 Add tests for URL normalization and opener delegation

## 4. Commit Context Menu UI

- [x] 4.1 Add row context-menu support to the virtual table or commit list without treating right-click as row selection or breaking keyboard navigation
- [x] 4.2 Create a commit-row context menu component with `Commit`, `Compare`, `Create From Commit`, `Apply To Current Branch`, and conditional `Remote` groups
- [x] 4.3 Ensure opening the menu targets the clicked commit without changing the selected commit and closes on outside click or `Esc`
- [x] 4.4 Wire copy SHA, copy message, and copy patch actions with success/error notices
- [x] 4.5 Wire compare with parent and compare with working tree actions to a dedicated commit comparison modal
- [x] 4.6 Resolve remote URL availability and hide the `Remote` group when no commit URL can be built

## 5. Creation And Apply Flows

- [x] 5.1 Add a create-branch-from-commit form using the targeted commit SHA as base ref
- [x] 5.2 Add a create-tag-at-commit form using the targeted commit SHA as target
- [x] 5.3 Add a create-worktree-from-commit form requiring branch name and worktree path
- [x] 5.4 Add confirmation modals for cherry-pick and revert that name the target commit and current branch
- [x] 5.5 Disable cherry-pick and revert when no current branch is available and show a clear disabled reason
- [x] 5.6 Dispatch refs, commits, working changes, and worktree refresh events after successful or failed mutating operations

## 6. Verification

- [x] 6.1 Add component tests for menu grouping, action visibility, disabled states, and branch-menu cleanup
- [x] 6.2 Add API and utility tests for new commands and URL helpers
- [x] 6.3 Run the relevant frontend test suite
- [x] 6.4 Run the relevant Rust tests or Tauri build checks
- [x] 6.5 Run the production build
