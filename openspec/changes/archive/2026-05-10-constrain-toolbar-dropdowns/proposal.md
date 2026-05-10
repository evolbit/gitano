## Why

The repository and branch dropdowns in the top toolbar do not handle long option lists or long labels gracefully. When the list is too long, the dropdown can extend beyond the window bounds and trigger unusable outer scrolling. Long repository or branch names can also overflow visually instead of truncating cleanly.

## What Changes

- Constrain top-toolbar dropdown option lists to a maximum of 80% of the viewport height.
- Make long dropdown option lists scroll internally instead of forcing outer window scrolling.
- Truncate long repository and branch labels with ellipsis in the dropdown options.
- Apply the same containment and truncation behavior to both repository and branch dropdowns for consistency.

## Capabilities

### New Capabilities
- `toolbar-dropdown-containment`: Top toolbar dropdowns stay within the viewport and handle long labels predictably.

### Modified Capabilities
- `workspace-toolbar-polish`: Toolbar dropdowns should remain usable for large repo/branch lists and long names.

## Impact

- Affected frontend area:
  - [src/components/TopToolbar.tsx](/Users/marco/repositories/gitano/src/components/TopToolbar.tsx)
- No backend or persistence changes are required.
