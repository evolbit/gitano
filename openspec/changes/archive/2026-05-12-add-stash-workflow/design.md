## Context

Gitano already has three adjacent pieces that this change can build on: executable toolbar action tiles, the left-pane bottom navigation shell, and the inline diff workspace that replaces panes without destroying repository selection state. The missing piece is a stash workflow that feels native to the current repository workspace instead of forcing users into external tooling.

This change crosses frontend layout, persisted workspace state, and backend Git commands. It also has one important constraint from the exploration: bulk file actions in the stashes section must stay aligned with Git semantics. Applying selected files from a stash is acceptable, but partially popping or deleting a stash through the bulk footer would create confusing and fragile behavior.

## Goals / Non-Goals

**Goals:**
- Add first-class stash actions in the toolbar for stash-all and pop-latest.
- Allow the current changes area to create a stash from the currently selected files and folders.
- Replace the left-pane `Folders` section with a `Stashes` section that supports stash browsing and file-level apply selection.
- Reuse the existing inline diff workspace for stash-file inspection in read-only mode.
- Keep the UI responsive by delegating stash logic to backend commands and avoiding client-side reconstruction of stash patches where possible.

**Non-Goals:**
- Support line-level or hunk-level stash creation from the current changes selection state.
- Support partial `Pop` or partial `Delete` from the bulk footer action area.
- Introduce a separate stash modal or detached workflow outside the repository workspace.
- Persist per-stash file checkbox selections across sessions unless they are already covered naturally by repo workspace state.

## Decisions

### 1. Treat stash as a first-class workspace capability, not as an extension of remote actions

The toolbar stash and pop controls will reuse the existing button and feedback patterns, but stash behavior will be specified as its own capability rather than extending `toolbar-remote-actions`. Stash is local repository state, not a remote operation, and keeping it separate avoids confusing future spec ownership and store naming.

Alternative considered:
- Extend remote-action behavior to include stash notices. Rejected because stash is not conceptually remote and would continue the existing naming mismatch.

### 2. Replace `Folders` with `Stashes` in the left-pane navigation contract

The bottom navigation currently specifies `Changes`, `Branches`, and `Folders`, but `Folders` is only a placeholder. The new `Stashes` pane becomes the third real workspace section, with its own header, two vertically split panes, and bottom action bar.

Alternative considered:
- Keep `Folders` internally and only relabel it visually. Rejected because persisted workspace state and future specs would become misleading.

### 3. Use a dedicated stashes panel with a selected-stash file list and a single bulk `Apply` action

The stashes pane will contain:
- a top list of stash entries,
- a resizable lower file list for the selected stash,
- `Select All` / `Unselect All` controls for the file list,
- and a footer action area centered on a single `Apply` action.

This deliberately avoids bulk `Pop`, `Delete`, or `Edit Message` controls in the footer. Those remain row actions on the stash entry itself via the hover-only three-dot menu.

Alternative considered:
- Provide `Apply`, `Pop`, `Delete`, and `Edit` in the footer based on file selection. Rejected because `Pop` and `Delete` are stash-entry semantics, not selected-file semantics, and editing fits better as an inline row action.

### 4. Support selected-file stash creation from current changes, but not selected-line stash creation

The current changes selection model is line-aware because it serves staging, but Git stash operations map more safely to files and paths. The commit-action `Stash` option will operate on the currently selected files and folders from the current changes pane, not on arbitrary selected lines.

Alternative considered:
- Translate staged line selections into temporary patch-based stash creation. Rejected for the first iteration because it adds backend complexity and weakens performance and reliability.

### 5. Keep stash row actions whole-entry and make message editing inline

Each stash row will expose `Apply Stash`, `Pop Stash`, `Delete Stash`, and `Edit Stash Message` through the hover-only three-dot menu. Choosing `Edit Stash Message` will switch only that row into inline edit mode instead of opening a second editor surface in the pane footer.

Alternative considered:
- Open a commit-like editor in the footer for message editing. Rejected because it competes with the file-apply workflow and makes the pane harder to scan.

### 6. Reuse the inline diff viewer in read-only mode for stash files

Clicking a stash file will open the same inline diff surface used elsewhere in the workspace. The stash variant will preserve shared controls such as split/unified mode, `Esc`, and close, but it will suppress staging affordances and file-stage callbacks.

Alternative considered:
- Build a dedicated stash diff renderer. Rejected because the current inline diff model already matches the desired UX and reduces implementation surface area.

## Risks / Trade-offs

- [Stash message editing is not a native rename operation] -> Implement backend message editing by recreating or rewriting the stash entry behind a dedicated command so the UI stays simple.
- [Partial file apply from stash may be backend-specific] -> Encapsulate all path-filtered stash behavior behind backend commands instead of teaching the frontend patch semantics.
- [Replacing persisted `folders` state may require migration] -> Map legacy `folders` values to `stashes` during workspace state hydration or fallback normalization.
- [Read-only stash diffs could accidentally expose stage controls through shared components] -> Add an explicit non-stageable mode to the inline diff host rather than relying on implicit `sha` behavior alone.
