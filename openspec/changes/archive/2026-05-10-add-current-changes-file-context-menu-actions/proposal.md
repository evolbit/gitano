## Why

The current-changes file list in the diff modal only exposes a pane-level context menu. That menu is generic and does not reflect the file the user right-clicked, which makes it impossible to provide file-specific actions like stage, discard, or trash in the way desktop Git clients do.

Users need a row-level context menu that adapts to tracked versus untracked files and exposes the right file actions directly where they are working.

## What Changes

- Add a file-row context menu in the current-changes diff modal.
- Show different menu contents for tracked files and untracked files.
- Implement these actions initially:
  - `Stage File` / `Unstage File`
  - `Discard Changes` for tracked files
  - `Trash File` for untracked files
- Include but do not implement yet:
  - `Stash File`
  - `Show in Finder` / OS-specific file manager label
  - `View File Blame` for tracked files

## Capabilities

### New Capabilities
- `current-changes-file-context-menu`: Defines file-specific context menus and actions in the current-changes diff modal.

## Impact

- Affected code in `src/components/ChangesExplorer.tsx` and related backend Git/file commands for discard and trash.
- The current-changes modal interaction model becomes row-specific instead of relying only on the generic pane menu.
