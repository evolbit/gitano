## Context

Several components currently contain their own pure helpers for working with slash-delimited paths and tree-shaped data. `BranchList` builds a grouped branch tree, `ChangesExplorer` builds and traverses a compressed file tree, and `FileListItem` splits a path into directory and file name pieces inline. The logic is correct, but it is spread across component files and makes those components longer and harder to evolve.

This change is a code organization refactor with no intended user-facing behavior change. The goal is to extract shared pure utilities while keeping the rendering and interaction code in the components themselves.

## Goals / Non-Goals

**Goals:**
- Extract shared pure helpers for path splitting and tree construction/traversal.
- Reuse those helpers from the branch list, changes explorer, and file list components.
- Keep ordering, path semantics, and tree compression behavior unchanged.
- Reduce the amount of utility code embedded directly inside component files.

**Non-Goals:**
- Do not change the visible UI or interaction model.
- Do not introduce a new shared UI primitives layer yet.
- Do not refactor the full component folder structure in this change.
- Do not alter branch grouping rules, file sorting, or tree compression behavior.

## Decisions

1. **Extract only pure helpers first**
   - We will move path and tree transformation logic into reusable utility modules, but keep JSX rendering and event handling inside the components.
   - Rationale: pure functions are low-risk to extract and easy to validate.
   - Alternative considered: moving row rendering primitives at the same time. Rejected for now because that broadens scope and mixes visual refactors with pure logic extraction.

2. **Keep the utility surface focused**
   - The first pass will cover helpers such as file name/parent path parsing, ancestor folder lookup, branch grouping, and tree building/traversal.
   - Rationale: these are the repeated utility-shaped functions identified in the scan.
   - Alternative considered: a single generic tree engine for every component. Rejected because the branch tree and compressed file tree have different needs, and a generic abstraction would add complexity before the codebase is ready for it.

3. **Preserve current behavior exactly**
   - The extracted helpers must produce the same output order and structure as the current inline functions.
   - Rationale: this is a maintainability refactor, not a product change.
   - Alternative considered: changing sort or compression rules while extracting. Rejected because that would mix refactor risk with behavior change.

4. **Prepare for later folder-based refactoring**
   - The extracted modules should live in a utilities area so that later component folder splitting can adopt them without rewriting the logic again.
   - Rationale: this change should make the eventual `utils/` and `shared/` split straightforward.

## Risks / Trade-offs

- [Abstraction creep] → Keep the utilities small and purpose-built; avoid a generic tree framework until there is a clear third consumer.
- [Behavior drift] → Preserve existing ordering/compression semantics and verify the affected render paths before considering the refactor complete.
- [Import churn] → Several component files will need new imports, but this is acceptable because it centralizes reusable logic.
- [False sharing] → Some helpers look similar but are not actually reusable. Only extract helpers that are truly pure and broadly useful.

## Migration Plan

1. Add shared utility modules for path and tree helpers.
2. Update `BranchList`, `ChangesExplorer`, and `FileListItem` to use the shared helpers.
3. Keep component-local UI code unchanged.
4. Verify the affected explorer and list views still render the same output and behavior.
5. Leave UI primitives and component-folder reorganization for a later change.

Rollback is straightforward: restore the inline helpers in the component files if any helper extraction causes a regression.

## Open Questions

- Should the next refactor extract shared row primitives after this utility pass, or should that wait for the folder split?
- Do we want the utility modules to live under `src/components/utils/` or a more general `src/utils/` path once the broader folder split happens?
