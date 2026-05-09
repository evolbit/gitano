## Context

The shared changes explorer already tracks selection by file path and attempts to scroll the selected row into view. In practice, modal open timing and tree expansion order can leave the selected file highlighted but still outside the visible portion of the pane. Tree mode has an extra dependency because the selected file row may not exist until its ancestor folders are expanded.

## Goals / Non-Goals

**Goals:**
- Reveal the selected file automatically when the diff modal opens.
- Support both flat and tree explorer modes.
- Ensure tree mode expands ancestor folders before scrolling.

**Non-Goals:**
- Change the explorer's selection model.
- Add new modal controls or new context menu actions.
- Change the main workspace selection behavior outside the modal-open case.

## Decisions

### Put reveal-on-open behavior in the shared explorer
The modal decides which file is initially selected, but the shared explorer owns the rendered list or tree and therefore should own the “make selected file visible” behavior. This keeps the logic close to the DOM that needs to be revealed and allows the same rule to apply to both flat and tree presentations.

### Treat tree mode as reveal-then-scroll
In tree mode, scrolling cannot succeed unless the selected file row exists in the DOM. The explorer must therefore ensure ancestor folders are expanded before attempting to scroll the selected file into view.

### Use a post-render scroll path
The selected row may not be present during the first render pass of the modal. The implementation should use a post-render scroll strategy so the reveal happens after the list/tree has mounted and, in tree mode, after the ancestor expansion state is applied.

## Risks / Trade-offs

- **[Risk] Scroll runs before the selected node exists** → Mitigation: trigger reveal after modal mount and after tree expansion state settles.
- **[Risk] Tree expansion causes noisy state updates on open** → Mitigation: limit the forced expansion to the selected file's ancestor path.
- **[Risk] Flat and tree behavior drift apart** → Mitigation: keep one reveal responsibility in the shared explorer rather than separate modal-specific code paths.
