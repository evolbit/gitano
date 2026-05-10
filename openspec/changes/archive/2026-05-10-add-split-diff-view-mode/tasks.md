## 1. Diff Display Mode

- [x] 1.1 Add shared diff viewer state and controls for `Unified` and `Split` display modes.
- [x] 1.2 Define a split-row transformation from existing hunk lines to paired left/right visual rows without changing the backend diff format.

## 2. Split Renderer

- [x] 2.1 Implement split-mode rendering in the diff hunk/viewer components with old content on the left and new content on the right.
- [x] 2.2 Place the block and line selection gutters in the center seam for split mode while keeping unified mode unchanged.

## 3. Selection Behavior

- [x] 3.1 Reuse the existing line and block staging handlers for both display modes.
- [x] 3.2 Ensure block selection in split mode visibly selects the logical block across both rendered sides.

## 4. Verification

- [x] 4.1 Verify unified mode still behaves exactly as before.
- [x] 4.2 Verify split mode renders the requested center-gutter layout and preserves file, block, and line selection state while switching modes.
