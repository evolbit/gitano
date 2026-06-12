## 1. Visual Identity

- [x] 1.1 Add named conflict-pane visual metadata for `Incoming`, `Current`, and `Result` near the merge-conflict feature.
- [x] 1.2 Apply side/result visual identity to pane headers without changing existing layout density.
- [x] 1.3 Apply side-specific conflict highlight, active highlight, overview ruler, and accepted-result styles to normal Monaco panes.
- [x] 1.4 Apply matching side-specific highlight treatment to range-loaded read-only panes where they render conflict rows.

## 2. Side-Pane Action Spacing

- [x] 2.1 Add Monaco view-zone management to normal read-only side panes for per-region action rows.
- [x] 2.2 Render side-pane action widgets inside reserved non-numbered visual space so they never cover source lines.
- [x] 2.3 Ensure action row zones are added, updated, and removed when regions, accepted side state, active conflict, or editor sessions change.
- [x] 2.4 Keep very large range-loaded pane actions visible without obscuring loaded source lines.

## 3. Linked Side Alignment

- [x] 3.1 Derive per-region side line counts from the existing side-pane region projections.
- [x] 3.2 Add display-only alignment zones to the shorter side for supported normal Monaco panes.
- [x] 3.3 Preserve existing scroll synchronization guards so programmatic scroll updates do not loop.
- [x] 3.4 Keep active-region reveal behavior from recentering repeatedly during synced scroll updates.
- [x] 3.5 Preserve current result-editor synchronization unless implementation testing shows it should be decoupled.

## 4. Tests

- [x] 4.1 Add or update colocated tests for side/result visual metadata and header rendering.
- [x] 4.2 Add tests proving side-pane action rows reserve view-zone space and do not rely only on overlay content widgets.
- [x] 4.3 Add tests for alignment-zone calculation when incoming/current conflict regions have different line counts.
- [x] 4.4 Add tests for scroll synchronization guards and no repeated active-region recentering.
- [x] 4.5 Add tests for range-loaded pane non-overlapping action presentation.

## 5. Verification

- [x] 5.1 Run focused Vitest coverage for conflict resolution surface, read-only panes, and result editor.
- [x] 5.2 Run `pnpm run lint`.
- [x] 5.3 Run `pnpm test`.
- [x] 5.4 Run `pnpm run build`.
- [x] 5.5 Verify the changed UI at desktop and narrow widths.
- [x] 5.6 Run OpenSpec validation for `improve-merge-editor-visual-alignment`.
