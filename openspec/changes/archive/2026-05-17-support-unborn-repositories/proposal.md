## Why

Gitano currently treats a local path as openable when `Repository::open` succeeds, but several workspace APIs still assume the repository has a resolved `HEAD` commit. A freshly initialized repository is valid Git state: `HEAD` points at a branch name, but no commit object exists yet. Users can already create this state outside Gitano with `git init` and open that folder through the launchpad.

If Gitano reports those repositories as broken, the app blocks a normal first-commit workflow and makes future local repository creation harder. Supporting unborn repositories first gives the app a correct foundation for opening existing empty repos and later creating new local repos from inside Gitano.

## What Changes

- Let users initialize a local folder as a new Git repository from the launchpad.
- Treat initialized repositories with no commits as valid local repositories.
- Introduce a first-class repository state that distinguishes invalid folders, unborn repositories, normal repositories, and detached `HEAD` repositories.
- Make branch/current-repository APIs return the symbolic unborn branch name without requiring a `HEAD` commit target.
- Show empty, actionable workspace states for commit history and ref-dependent surfaces instead of raw backend errors.
- Keep working-tree, staging, and commit creation usable so users can make the first commit from Gitano.
- Guard actions that require an existing commit with disabled states or clear non-destructive errors.
- Refresh repository state after the first commit so the workspace transitions from unborn to normal without reopening.

## Capabilities

### New Capabilities
- `local-repository-creation`: Creating a local Git repository from an existing folder.
- `unborn-repository-support`: Opening, displaying, and operating on initialized local repositories before their first commit.

### Modified Capabilities
- None.

## Impact

- Backend Git state handling: shared helpers for unborn `HEAD` detection and current branch resolution.
- Backend Git commands: branch/current state, commit history, working diff, staged diff, staging, and first-commit paths.
- Frontend adapters/types: typed repository state and branch/current repository responses.
- Launchpad and workspace UI: recent repo rows, toolbar, branch/worktree/tag/history panels, and commit bar empty states.
- Tests: Rust command coverage for unborn repositories and frontend coverage for open/recent/workspace behavior.
