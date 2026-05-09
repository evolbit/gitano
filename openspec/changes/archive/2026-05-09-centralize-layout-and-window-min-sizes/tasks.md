## 1. Shared Layout Configuration

- [x] 1.1 Create a shared layout constants module for the main repo view that defines left, middle, and right pane sizing with numeric `min` values and configurable `initial` values.
- [x] 1.2 Derive the minimum window width from the sum of the left, middle, and right pane minimum widths in that shared configuration.

## 2. Main Layout Integration

- [x] 2.1 Update `src/components/RepoTabLayout.tsx` to replace inline split-pane sizing literals with the shared layout configuration values.
- [x] 2.2 Ensure the nested split configuration still enforces the logical three-pane model where left is at least `300`, middle is at least `500` and grows, and right is at least `300`.

## 3. Window Minimum Sizing

- [x] 3.1 Update window sizing initialization to apply the minimum window width from the shared layout configuration at runtime.
- [x] 3.2 Keep the static Tauri window configuration aligned with the intended base dimensions without becoming the primary source of truth for the derived minimum width.

## 4. Verification

- [x] 4.1 Verify the main repo layout still renders correctly and the middle pane uses the remaining available space after left and right constraints are applied.
- [x] 4.2 Verify the window cannot be resized narrower than `1100` and that pane resizing still behaves correctly with numeric and percentage-based initial values.
