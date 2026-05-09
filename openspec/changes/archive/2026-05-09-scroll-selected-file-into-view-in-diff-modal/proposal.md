## Why

When the diff modal opens, the selected file can already be highlighted in the left pane but still remain out of view if the file list is long. This weakens the navigation experience because the modal does not visually confirm the file that opened it, especially in tree mode where the file may also be nested under folders.

## What Changes

- Ensure the diff modal scrolls the left file pane so the initially selected file is visible when the modal opens.
- Ensure this reveal behavior works in both `Flat View` and `Tree View`.
- Ensure tree mode expands the selected file's ancestor folders before attempting to scroll it into view.

## Capabilities

### New Capabilities

### Modified Capabilities
- `changes-explorer-views`: the shared changes explorer must reveal the selected file on modal open in both flat and tree modes.
- `working-tree-diff-modal`: the modal must visibly reveal the file that opened it in the left pane.

## Impact

- Affected frontend behavior in the shared changes explorer and diff modal open flow.
- No backend or Git contract changes expected.
