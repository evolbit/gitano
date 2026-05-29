## Why

Pull request workflows currently open as modal overlays, which interrupts the repository workspace and makes it harder to preserve exact view context when moving between normal repository work and PR review. Presenting pull requests as a repository-level surface lets users toggle between workspace and PR workflows while keeping each repository's state intact.

## What Changes

- Replace the pull request list modal with an inline pull requests surface that occupies the repository workspace body.
- Replace the pull request review modal with an inline review mode inside the pull requests surface.
- Add per-repository surface state so each repository remembers whether it is showing the normal workspace or pull requests.
- Preserve normal workspace UI state when switching to pull requests, including selected panes, selected files, pane sizes, tree state, and relevant scroll positions.
- Preserve pull request UI state per repository and pull request number, including list/review mode, selected PR, selected file, diff display mode, conversation visibility, draft text where appropriate, and relevant scroll positions.
- Change the top toolbar PR control into a per-repository surface toggle:
  - In normal workspace mode it shows the PR entry action and count.
  - In pull request mode it changes to a workspace-return action.
- Keep inactive surfaces unmounted and restore explicit UI state instead of keeping both full workspace trees mounted.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `github-pr-review-workflow`: Pull request list and review workflows move from modal presentation to an inline repository surface with internal list/review navigation.
- `workspace-ui-persistence`: Repository UI persistence expands to track active surface state, surface scroll restoration, and PR review UI state keyed per repository and pull request.

## Impact

- Frontend repository workspace composition in `src/features/repository-workspace`.
- Pull request list components in `src/features/pull-requests`.
- Pull request review components in `src/features/branches`.
- Workspace UI state store and tests in `src/features/repository-workspace/stores`.
- Toolbar PR button behavior and tests in `src/features/repository-workspace/components/top-toolbar`.
- No backend API or Tauri command shape changes are expected.
