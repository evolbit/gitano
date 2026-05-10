## Why

The current working-changes staging flow is deferred. Users select lines, blocks, or files in the UI, but those selections only become real Git staging operations when commit is triggered. That creates a mismatch between what the UI appears to represent and what is actually in the Git index.

The desired behavior is closer to GitHub Desktop:

- selecting a line, block, or file stages it immediately
- deselecting or unchecking unstages it immediately
- committing uses whatever is already in the Git index

This makes the UI more honest and gives users immediate control over what is staged.

## What Changes

- Make working-changes selection update the Git index immediately instead of deferring staging to commit time.
- Treat the Git index as the source of truth for staged vs unstaged working changes.
- Support immediate staging and unstaging for:
  - modified tracked files
  - untracked files at file level
  - deleted files at file level
- Simplify commit behavior so it commits already-staged content instead of applying staged selections only at commit time.

## Capabilities

### New Capabilities
- `immediate-index-staging`: Working-changes selection immediately stages and unstages content in the Git index.

### Modified Capabilities
- `working-tree-diff-modal`: Working-tree diff interactions should immediately reflect real staged state from Git.
- `edit-diff-selection-gutters`: Line/block/file selection in editable diffs should trigger immediate stage/unstage behavior instead of deferred commit-time staging.

## Impact

- Affected frontend areas:
  - [src/store/staging.ts](/Users/marco/repositories/gitano/src/store/staging.ts)
  - [src/hooks/useStageAndCommit.ts](/Users/marco/repositories/gitano/src/hooks/useStageAndCommit.ts)
  - [src/components/ChangesExplorer.tsx](/Users/marco/repositories/gitano/src/components/ChangesExplorer.tsx)
  - [src/components/DiffViewer.tsx](/Users/marco/repositories/gitano/src/components/DiffViewer.tsx)
  - [src/components/DiffHunk.tsx](/Users/marco/repositories/gitano/src/components/DiffHunk.tsx)
- Affected backend areas:
  - [src-tauri/src/git/staging.rs](/Users/marco/repositories/gitano/src-tauri/src/git/staging.rs)
  - [src-tauri/src/git/commands.rs](/Users/marco/repositories/gitano/src-tauri/src/git/commands.rs)
  - [src-tauri/src/main.rs](/Users/marco/repositories/gitano/src-tauri/src/main.rs)
