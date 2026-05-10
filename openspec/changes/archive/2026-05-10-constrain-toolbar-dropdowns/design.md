## Context

The top toolbar uses Mantine `Menu` dropdowns for repository and branch selection. These dropdowns currently render their result lists without a viewport-bound scroll container, so long lists can grow past the visible window. Long labels also lack consistent truncation inside the option rows.

## Goals / Non-Goals

**Goals:**
- Keep repository and branch dropdowns visually contained within the app window.
- Limit dropdown result height to 80% of the viewport.
- Ensure the list itself scrolls internally when too many results are present.
- Truncate long option labels with ellipsis instead of letting them overflow.

**Non-Goals:**
- Change the search/filtering behavior.
- Change the repo/branch selection model.
- Redesign the dropdown visual style beyond containment and truncation.

## Decisions

### Use a viewport-bounded scroll area inside each dropdown
The dropdown should still open from the toolbar, but the result list should live inside an internal scroll container with `max-height: 80vh`. That avoids the current failure mode where the whole dropdown grows beyond the viewport.

### Keep the search row visible while scrolling results
The search input already acts like a header. The results list should scroll independently underneath it so the filter remains usable even for long lists.

### Truncate labels at the row text layer
Each dropdown option should render its text in a single line with ellipsis:

```text
overflow: hidden
text-overflow: ellipsis
white-space: nowrap
```

This should apply to both repository and branch items.

## Architecture Sketch

```text
Menu.Dropdown
├─ search header
└─ scroll container (max 80vh)
   ├─ option row
   ├─ option row
   └─ option row
```

## Risks / Trade-offs

- **[Risk] Mantine dropdown padding/layout fights the internal scroll area** → Mitigation: keep the change local to the dropdown body structure rather than overriding broad menu styles.
- **[Risk] Long labels still overflow because truncation is applied to the wrong wrapper** → Mitigation: apply ellipsis to the inner text node with a width-constrained flex layout.
