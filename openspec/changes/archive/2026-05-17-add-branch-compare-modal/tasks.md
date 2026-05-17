## 1. Backend Branch Comparison API

- [x] 1.1 Add Rust types for branch comparison file requests and responses where existing `FileChange` / `DiffHunk` shapes are not enough.
- [x] 1.2 Implement backend comparison mode selection for a base/target ref and head/source ref.
- [x] 1.3 Implement a Tauri command that returns changed files for direct branch comparison semantics while preserving merge-base support for future PR wrappers.
- [x] 1.4 Implement a Tauri command that returns hunks for one file in the active branch comparison.
- [x] 1.5 Register the new Tauri commands in the invoke handler.

## 2. Shared Frontend API And Types

- [x] 2.1 Add TypeScript request/response types for branch comparison file lists and file diffs.
- [x] 2.2 Add shared Git API functions for loading branch comparison files and per-file hunks.
- [x] 2.3 Add unit coverage for the new shared API command payloads.

## 3. Diff Renderer Boundary

- [x] 3.1 Extract the current unified/split hunk rendering into a base diff renderer that receives explicit hunks, file path, and display mode.
- [x] 3.2 Add a scoped diff interaction provider with optional line/block extension points and stable diff line anchors.
- [x] 3.3 Rebuild existing working-tree staging behavior as a wrapper/provider around the base renderer.
- [x] 3.4 Keep commit and stash diff loading in read-only wrappers around the base renderer.
- [x] 3.5 Verify existing working-tree, commit, and stash diff flows keep their current unified/split behavior.

## 4. Branch Comparison Modal

- [x] 4.1 Add branch comparison modal state to the branches workflow and wire `Compare to...` from branch context menu branch nodes.
- [x] 4.2 Create the branch comparison modal layout with source branch display, base branch selector, changed-file list, and right-side diff pane.
- [x] 4.3 Load local and remote branches for the modal in parallel and choose the default base branch from the current branch when valid.
- [x] 4.4 Load changed files for the active base/head pair and clear stale selected-file state when the comparison changes.
- [x] 4.5 Lazy-load hunks for the selected changed file and ignore stale responses from previous branch/file selections.

## 5. Virtualized Branch Target Dropdown

- [x] 5.1 Implement a grouped branch target dropdown with `Local` and `Remote` sections and a search input.
- [x] 5.2 Exclude the source branch from selectable branch target results.
- [x] 5.3 Render dropdown rows through `@tanstack/react-virtual` and keep row dimensions stable.
- [x] 5.4 Use deferred filtering or equivalent memoization so search stays responsive with hundreds of branches.
- [x] 5.5 Add empty, loading, and error states for branch target loading and filtering.

## 6. Draft Line Comments

- [x] 6.1 Add draft comment state scoped to the branch comparison modal session and keyed by comparison pair plus line anchor.
- [x] 6.2 Add line-level comment actions through the diff interaction provider.
- [x] 6.3 Render draft comment threads attached to their original lines in both unified and split display modes.
- [x] 6.4 Support editing draft comment text with non-empty validation.
- [x] 6.5 Support deleting draft comments.
- [x] 6.6 Discard all draft comments when the branch comparison modal closes.

## 7. Verification

- [x] 7.1 Add component or interaction tests for opening the modal from `Compare to...`, selecting a branch target, and viewing changed files.
- [x] 7.2 Add focused tests for draft comment add, edit, delete, and display-mode preservation.
- [x] 7.3 Add backend or API tests for branch comparison file list and per-file hunk command payloads.
- [x] 7.4 Run the existing frontend test suite.
- [x] 7.5 Run the frontend build.
