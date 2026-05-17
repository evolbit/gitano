## Context

The current app has a valid open check through `open_local_repo`, but downstream commands often equate "valid repository" with "repository has a `HEAD` commit." That is not true for a fresh `git init` checkout:

```text
repo/
└─ .git/
   └─ HEAD -> refs/heads/main

branch name exists conceptually
commit graph does not exist yet
```

This change should make that state explicit rather than patching each failure independently.

## Repository State Model

The backend should expose repository state as structured data instead of forcing the frontend to infer it from command failures.

```text
invalid path
  └─ not a Git repository

valid repository
  ├─ unborn branch
  │   ├─ branch: main/master/custom HEAD target
  │   └─ hasCommits: false
  ├─ normal branch
  │   ├─ branch: current branch
  │   └─ hasCommits: true
  └─ detached HEAD
      ├─ branch: null
      └─ hasCommits: true
```

Exact DTO naming can be chosen during implementation, but the contract needs to carry enough information for UI surfaces to know whether commit-dependent actions are available.

## Backend Approach

Add a shared Rust helper for opening a repository and resolving its head state. It should:

- Use Git/libgit2 semantics for unborn `HEAD` instead of treating `repo.head()` failure as invalid.
- Resolve the symbolic branch name from `HEAD` when the branch has no target commit.
- Provide a single source of truth for `hasCommits` / `isUnborn` so commands do not duplicate fragile checks.

Commands that need a commit should explicitly branch on this helper. For example:

- Commit history should return an empty page for unborn repositories.
- Current branch should return the unborn branch name, not an error.
- File diff and staged diff code should avoid `git diff HEAD` when no `HEAD` commit exists.
- First commit should keep using normal `git commit` once files are staged.

## Frontend Approach

The frontend should consume typed repository state through `src/shared/api` and render state-specific empty surfaces.

```text
Launchpad row
  unborn -> branch label + "No commits yet"

Workspace
  history -> empty first-commit state
  changes -> normal untracked/staged workflow
  toolbar -> disable commit-dependent actions
```

The UI should avoid storing "unborn" as a long-lived preference. It is live repository state and should refresh after actions such as first commit, branch creation, or external changes.

## Action Policy

Use a conservative default:

- Allow: open repo, view working changes, stage/unstage, commit first staged changes, reveal folder, remove from recents.
- Conditionally allow: fetch when remote configuration exists and command support is clear.
- Disable or guard: push, pull strategies that require a local commit, stash, amend, tag creation, cherry-pick, revert, branch compare, worktree creation from `HEAD`.

If a disabled action is visible, it should explain that the repository needs an initial commit first.

## Transition After First Commit

After the first commit succeeds, Gitano should refresh repository state, refs, history, and working changes. The user should not need to close and reopen the repo.

```text
unborn repo
  stage files
  commit
      │
      ▼
normal repo
  history visible
  branch actions enabled
```

## Risks

- Some existing commands call Git CLI with `HEAD` directly. Missing one will leave a visible error path for unborn repositories.
- Changing current branch return types could ripple through toolbar and branch consumers. A compatibility adapter or parallel repository-state command may reduce churn.
- Staged diff behavior before the first commit needs careful testing because the baseline is the empty tree, not `HEAD`.
