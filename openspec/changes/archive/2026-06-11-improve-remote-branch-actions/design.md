## Context

The branches panel already renders unified branch refs with local/origin metadata and uses that metadata to enable or disable context menu actions. Local rows support checkout and local branch operations, but remote-only rows currently cannot be activated by double-click and do not expose the remote branch workflows users expect from a Git desktop client.

The screenshot-inspired actions should be adapted to Gitano's branch panel rather than copied directly. Branch rows should expose branch workflows; commit-tip actions such as cherry-pick, create tag, and reset stay out of scope for now.

## Goals / Non-Goals

**Goals:**

- Make remote branch rows actionable from both double-click and context menu checkout.
- Ensure remote checkout creates or switches to a local tracking branch instead of detaching `HEAD`.
- Add remote branch merge, rebase, worktree, branch creation, comparison, delete, and copy/link actions with explicit direction labels.
- Keep destructive remote deletion behind confirmation.
- Show pull request actions only when a matching open pull request is known.
- Keep Git ref validation and mutation semantics in typed Tauri adapters and Rust commands.

**Non-Goals:**

- Add cherry-pick, create tag, reset, hide, pin, or solo actions to remote branch rows.
- Add arbitrary remote selection beyond the existing origin-oriented branch workflow.
- Add new provider support beyond the existing GitHub/provider pull request APIs.
- Change toolbar pull, fetch, or push defaults.

## Decisions

### Decision: Remote checkout uses tracking local branches

Double-clicking or choosing `Checkout origin/<branch>` should route through one checkout action. If local `<branch>` already exists, Gitano checks out that local branch. If it does not exist, Gitano creates a local tracking branch from `origin/<branch>` and checks it out. This avoids detached `HEAD` and matches what users typically mean by checking out a remote branch.

Alternative considered: checkout `origin/<branch>` directly. That is technically valid but leaves the repository detached, makes later commits awkward, and conflicts with the branch panel's local branch selection model.

### Decision: Remote branch operations target the current branch

Remote merge and rebase actions should operate on the current checked-out branch and name the direction in the label, for example `Merge origin/foo into main` and `Rebase main onto origin/foo`. Backend commands should accept a validated remote source ref for merge/rebase instead of pretending the remote source is a local branch.

Alternative considered: reuse existing local branch operation commands unchanged. Those commands currently validate both target and source as local branches, which would either reject remote rows or require frontend-only translation that hides the actual Git ref being used.

### Decision: Remote delete is a separate command with explicit confirmation

Deleting `origin/foo` should run a remote delete, not delete a local tracking ref directly. The UI should label it as `Delete origin/foo...`, confirm that it deletes the branch from `origin`, and then run `git push origin --delete foo`. Local delete and remote delete remain separate flows.

Alternative considered: remove the local `refs/remotes/origin/foo` ref. That would only change the local repository and would be surprising because the menu label names a remote branch.

### Decision: Pull request actions are conditional

Gitano should show review/view/copy pull request actions only after it can match an open pull request whose head branch corresponds to the selected remote branch. The branch menu should not render disabled PR placeholders when GitHub is disconnected, the repository is unsupported, or no matching PR exists.

Alternative considered: always show PR actions as disabled menu items. That creates noise in the most common repositories where a remote branch has no open PR.

### Decision: Link copy actions use web URL helpers

The menu should offer copy branch URL and copy remote commit URL only when the origin remote URL can be normalized to a provider web URL. Branch URLs should preserve slash-separated branch path segments, and commit URLs should reuse the existing provider-specific commit URL behavior.

Alternative considered: copy raw Git ref names only. Gitano already has clipboard support for branch name and SHA, and web links are a distinct workflow needed for sharing.

## Risks / Trade-offs

- Remote branch name parsing can be wrong for non-origin remotes -> Limit the first implementation to origin-backed rows already represented by `originName`, and validate the parsed remote/ref in Rust before running Git.
- Creating a tracking local branch can collide with an existing unrelated local branch -> Prefer checkout of the existing local branch when the unified branch ref says it exists; otherwise let Git report the collision and surface backend error details.
- Merge/rebase can leave conflicts or in-progress operations -> Reuse existing git-action feedback and refresh repository state after completion or failure so conflict surfaces can update.
- Pull request matching can be stale or unavailable -> Keep PR actions conditional and avoid blocking the menu on provider requests.
- Remote delete is destructive -> Require confirmation copy that names the remote branch and does not reuse local branch delete confirmation text.
