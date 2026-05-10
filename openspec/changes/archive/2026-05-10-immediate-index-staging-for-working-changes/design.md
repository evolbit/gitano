## Context

The current app stores working-change staging selections in Zustand and only materializes them in Git when the commit action runs. The backend already supports partial staging through `git_stage_lines` and whole-file staging for new files through `git_add_file`, but there is no full immediate bidirectional stage/unstage flow yet.

## Goals / Non-Goals

**Goals:**
- Make stage/unstage interactions apply to the Git index immediately.
- Make the UI reflect the actual index state instead of a deferred local staging plan.
- Support tracked modified files, untracked files, and deleted files coherently.
- Let commit operate on already-staged content.

**Non-Goals:**
- Redesign the diff selection UI itself.
- Introduce advanced partial staging for brand-new untracked files beyond file-level behavior.
- Rework committed-diff read-only flows.

## Decisions

### Git index becomes the source of truth
The app should stop treating the local `stagedLines` store as the primary truth for staging. Instead:

```text
user toggles selection
-> backend stage/unstage operation
-> refresh working changes and diff state
-> UI reflects actual index state
```

The local store may still exist as a transient helper during interaction, but it should not define staging independently of Git.

### Modified tracked files support immediate line/block/file staging
For modified tracked files:
- selecting a line stages it immediately
- deselecting a line unstages it immediately
- selecting a block stages it immediately
- deselecting a block unstages it immediately
- file-level checkbox stages/unstages the whole file immediately

### Untracked and deleted files remain file-level
For untracked and deleted files:
- file checkbox stages immediately
- unchecking unstages immediately
- no line/block partial staging is required for those file classes in this change

### Commit should use already-staged content
The commit flow should no longer stage pending UI selections at commit time. It should simply commit what is already in the index, with validation if nothing is staged.

## Architecture Sketch

```text
Current
UI selection store
    -> commit action stages later
    -> git commit

Target
UI click/check
    -> backend stage/unstage now
    -> refresh repo state
    -> git index is source of truth
    -> commit uses staged content directly
```

## Risks / Trade-offs

- **[Risk] UI and backend refresh timing drift** -> Mitigation: ensure stage/unstage actions refresh working changes and diff state after mutation.
- **[Risk] Partial unstage semantics are more complex than partial stage semantics** -> Mitigation: define explicit backend unstage operations instead of trying to infer them only in the UI.
- **[Risk] Existing deferred commit logic conflicts with immediate staging** -> Mitigation: simplify commit behavior to consume already-staged content only.
