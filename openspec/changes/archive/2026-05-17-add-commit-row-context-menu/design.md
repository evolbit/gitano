## Context

The branch context menu currently contains commit-oriented placeholder items for cherry-pick, reset, and revert. Those actions are ambiguous when opened from a branch ref because the only implied commit is the branch tip. Commit rows already carry the exact commit SHA, message, parent metadata, and selection behavior needed to make these actions understandable.

The history surface is currently centered on `CommitList`, `ChangesPanel`, and existing inline diff surfaces. Branch and tag/worktree workflows already provide useful patterns for context menus, confirmation modals, notices, repository refresh events, and backend-owned Git operations.

## Goals / Non-Goals

**Goals:**
- Remove misleading commit placeholders from the branch context menu.
- Add a commit-row context menu with grouped, explicit actions.
- Implement the first-pass actions that are clear for a single targeted commit: copy, compare, create branch/tag/worktree, cherry-pick, revert, and remote commit link actions.
- Keep Git mutation logic in Tauri commands and keep frontend components focused on state, forms, and notices.
- Use confirmations for repository-mutating commit actions.

**Non-Goals:**
- No `Delete commit` action.
- No history-rewrite actions in this change, including `Undo last commit`, `Drop commit`, or `Reset current branch to this commit`.
- No interactive rebase workflow.
- No multi-select commit actions.
- No remote provider API integration; remote links are derived from the configured origin URL only.

## Decisions

### Commit Menu Owns Commit-Specific Actions

The branch context menu will no longer show `Cherry pick commit`, `Reset ... to this commit`, or `Revert commit`. These actions belong on commit rows where the SHA is explicit.

Alternative considered: keep branch-tip variants in the branch menu. This was rejected because labels like `Cherry-pick tip commit of <branch>` are niche and still surprise users who expect branch actions from a branch menu.

### Group Actions By Intent

The commit context menu will use stable sections:
- `Commit`
- `Compare`
- `Create From Commit`
- `Apply To Current Branch`
- `Remote`

The risky rewrite-history section is intentionally absent in this change. A later change can add it with dedicated confirmation, dirty-worktree handling, and conflict recovery behavior.

### Backend Commands For Git Mutations And Patch Text

Cherry-pick, revert, and patch generation will be exposed through Tauri commands. The frontend should not shell out or reconstruct Git behavior. This keeps conflict/error handling centralized and matches the current branch-operation pattern.

Copying the row commit SHA and visible message can happen in the frontend. Copying the patch should use backend output so the copied content matches Git's canonical patch for that commit.

### Context Menu Targeting Behavior

Opening the menu on a commit row should target that row without selecting it or updating the active tab's selected commit. Left-click remains the way to select a commit and show its existing changes pane, so the context menu does not duplicate that default row behavior.

`Compare with parent...` and `Compare with working tree...` should open a dedicated commit comparison modal that follows the branch compare modal's layout: changed files on the left and the selected file diff on the right. The parent comparison uses the first parent as the base, or an empty tree for an initial commit. The working-tree comparison uses the targeted commit as the base and the current working tree/index state as the head.

The compare modal should use the context-menu target directly and should not change the active tab's selected commit. Left-click remains the way to select a commit and show its existing changes pane.

### Remote URL Derivation

Remote commit actions should be shown only when an origin URL can be resolved into a supported browser URL. The URL builder should normalize HTTPS and SSH remote forms and produce provider-appropriate commit URLs:
- GitHub and generic web remotes: `/commit/<sha>`
- GitLab: `/-/commit/<sha>`
- Bitbucket: `/commits/<sha>`

If no remote URL is available, the `Remote` section should be hidden rather than showing dead actions.

## Risks / Trade-offs

- Cherry-pick or revert can create conflicts -> show an error notice with the backend error and refresh repository state so the user sees the resulting working tree.
- `Compare with working tree...` can be expensive or ambiguous with dirty/staged files -> keep the operation backend-owned and render loading/error states; compare the targeted commit tree against the current working tree/index state according to the command contract.
- Commit URL derivation may not work for all self-hosted providers -> support common URL shapes first and hide actions when the URL cannot be normalized.
- Create worktree from a commit requires a branch name -> use a small form/confirmation flow with generated defaults rather than silently creating an opaque branch.
