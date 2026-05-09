## Context

The current commit table should behave like the Git terminal for branch history. The user expectation is simple: selecting a branch should show the same history they would see with `git log <selected-branch>`, with `--first-parent` as an optional alternate view. The commit-table control strip should focus on that workflow and remove unrelated actions.

## Goals / Non-Goals

**Goals:**
- Show selected-branch history exactly like `git log <selected-branch>` by default.
- Add a commit-table control for switching between `Git log` and `First parent` history modes.
- Keep the search box in the commit table controls and remove the `Filtros` and `Añadir manualmente` buttons.
- Reload and reset commit pagination when branch selection or history mode changes.

**Non-Goals:**
- Inferring branch ownership or branch-only commits.
- Building a base-branch picker or inferred base-branch workflow.
- Redesigning unrelated commit-table behavior such as row rendering, selection, or diff loading.

## Decisions

Treat branch history as explicit branch-tip history. The backend should walk the selected branch ref directly, matching `git log <selected-branch>` ordering by default and `git log --first-parent <selected-branch>` when the alternate mode is selected.

Use two explicit history modes. `Git log` is the default exact branch history view, and `First parent` is an alternate view that simplifies the selected branch ancestry without changing the selected ref.

Simplify the commit-table top bar into history-focused controls only. The search box remains, a view-mode selector is added, and the `Filtros` / `Añadir manualmente` buttons are removed because they do not align with the branch-history workflow.

Extend the backend request shape as needed to accept the selected history mode while keeping the response focused on commit rows and pagination.

## Risks / Trade-offs

- [Branch history may still surprise users after merges or rebases] -> Match Git's own traversal semantics exactly and make the mode explicit (`Git log` vs `First parent`).
- [Backend API changes can ripple into commit-table state management] -> Keep the API extension narrow and reset pagination/selection predictably when history inputs change.
