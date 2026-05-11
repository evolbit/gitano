## Context

The current `src/components` directory contains a mix of top-level component files, small utility modules, and a few components that already carry multiple responsibilities inside a single file. Some logic is already reusable and should remain shared, while other logic is specific to one component and should move with that component into its own folder.

This change is a structural refactor only. The application should render and behave the same before and after the move. The main goal is to make the codebase easier to read, easier to navigate, and easier to extend without repeating utility logic inside component files.

## Goals / Non-Goals

**Goals:**
- Move each component into its own folder.
- Separate local types and hooks from JSX when that separation improves readability.
- Keep shared pure helpers in utility modules that can be imported by multiple components.
- Preserve runtime behavior, styling, and interaction semantics.

**Non-Goals:**
- Do not change application behavior.
- Do not redesign component APIs as part of this refactor.
- Do not introduce new UI patterns or product features.
- Do not force every component to have `types.ts` or `hooks.ts` if it does not need them.

## Decisions

1. **Folder-per-component organization**
   - Each component should live in its own folder so the file structure mirrors the logical ownership of the code.
   - Rationale: this keeps related files together and makes large components easier to scan.
   - Alternative considered: keep flat files and only extract utilities. Rejected because the user explicitly wants a folder-based refactor.

2. **Local concerns stay local**
   - Component-specific types and hook orchestration should move into the same folder as the component, but only when they reduce noise and improve readability.
   - Rationale: this keeps the render file focused on UI.
   - Alternative considered: centralize all types/hooks in global shared folders. Rejected because many of these concerns are not reusable outside the component they support.

3. **Shared pure helpers belong in utilities**
   - Helpers that are pure and useful to multiple components should live in utility modules rather than being duplicated or tucked into one folder.
   - Rationale: this avoids the refactor simply moving duplication around.
   - Alternative considered: keep shared helpers inside the first component that needed them. Rejected because that discourages reuse and makes future cleanup harder.

4. **Behavior-preserving migration**
   - The refactor should be implemented as a file move and import cleanup, not as a logical rewrite.
   - Rationale: reducing the number of moving parts lowers regression risk.
   - Alternative considered: refactor component logic while moving files. Rejected because it mixes structure with behavior changes.

## Risks / Trade-offs

- [Import churn] → Use incremental file moves and update imports carefully; verify each moved component still builds conceptually before moving to the next.
- [Over-fragmentation] → Do not create `types.ts` or `hooks.ts` files for components that do not benefit from them.
- [Premature abstraction] → Keep utility modules focused on proven shared logic rather than building a generic framework too early.
- [Folder sprawl] → Group by component role (`diff`, `explorer`, `toolbar`, etc.) so the folder tree stays navigable.

## Migration Plan

1. Move simple leaf components into one-file folders first.
2. Keep existing shared utility modules as the canonical home for pure helpers.
3. Split larger components into `Component.tsx`, `types.ts`, and `hooks.ts` where appropriate.
4. Update imports across the component layer.
5. Verify that runtime behavior and visual output remain unchanged.

Rollback is straightforward: move the files back to their previous locations and restore the previous import paths if any folder move introduces problems.

## Open Questions

- Should the folder split be fully completed in one change, or should it be staged by component group?
- Do we want an explicit naming convention for folder names, such as kebab-case directories with PascalCase component files?
- Should some of the existing top-level utility modules be renamed or relocated during the refactor, or left where they are for now?
