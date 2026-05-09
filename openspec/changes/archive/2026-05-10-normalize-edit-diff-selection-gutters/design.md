## Context

The current editable diff experience still diverges from the GitHub Desktop model in an important way: it only exposes two layers of selection in the diff view and treats the whole hunk as the block-level unit. GitHub Desktop actually exposes a three-level hierarchy:

- file-level checkbox in the left file list
- block-level checkbox for each contiguous changed block inside a hunk
- line-level checkbox for individual changed rows

The previous gutter normalization pass improved the visual structure, but it stopped at hunk-level toggles and therefore still selects too much at once. The left panel also needs to participate in the selection hierarchy with checked / unchecked / indeterminate file states.

## Goals / Non-Goals

**Goals:**
- Introduce a consistent hierarchical selection model across file, block, and line levels.
- Move block-level selection into the far-left diff gutter.
- Use a single line-selection gutter for row-level toggles.
- Show file-level tri-state selection in the left file list.
- Align the visual model and selection granularity more closely with GitHub Desktop.

**Non-Goals:**
- Changing how staging state is stored
- Reworking backend diff generation
- Redesigning committed-file read-only diff presentation

## Decisions

### Use a hierarchical selection model instead of hunk-only grouping
The diff should expose three visible selection layers: file, block, and line. This matches how users mentally scope staging operations and resolves the current mismatch where a single hunk toggle covers multiple unrelated changed regions.

Alternative considered:
- Keep using the entire hunk as the only non-line selection unit.
  - Rejected because one hunk can contain multiple distinct changed blocks that should be independently selectable.

### Derive block-level controls from contiguous changed line groups
Block selection should not mean the entire hunk. The hunk renderer should detect contiguous stageable rows and render one block-level control per group in the far-left gutter.

Alternative considered:
- Add only visual hunk-level gutters and defer block grouping.
  - Rejected because it still produces the wrong interaction granularity.

### Put file-level checkbox state in the left panel
The left file list should expose the file as the top-level staging unit with checked, unchecked, and indeterminate states based on the lines currently selected within that file.

Alternative considered:
- Keep file-level state implicit and only infer it from the diff view.
  - Rejected because the GitHub-style model explicitly exposes file-level staging in the left panel and users expect it there.

### Reuse existing line staging state to drive the hierarchy
The existing staged-line state should remain the source of truth. File and block checkbox states should be derived from that state rather than introducing a separate parallel model.

## Risks / Trade-offs

- [Contiguous block detection may be trickier than hunk-level grouping] -> Define blocks purely from contiguous stageable diff rows and keep the grouping logic local to the view layer.
- [File checkbox tri-state may drift from actual line selection] -> Derive the file state from staged lines on every render instead of caching it separately.
- [This expands beyond the original completed gutter refactor] -> Treat the previous implementation as superseded and update the tasks/checklist to reflect the corrected target.
