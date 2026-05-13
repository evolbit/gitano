## 1. Align branch panel framing and controls

- [x] 1.1 Refactor `src/components/branch-list/BranchList.tsx` to use shared left-pane top strip structure with a search input and right-side local/remote mode controls.
- [x] 1.2 Implement branch filtering behavior driven by the new search input across grouped branch tree nodes.

## 2. Align branch tree visual language

- [x] 2.1 Update branch row and group row styling in `BranchList.tsx` to match shared explorer hover/selection spacing and color semantics.
- [x] 2.2 Remove vertical connector rails from nested branch groups while preserving hierarchy readability via indentation and chevrons.

## 3. Enforce priority branch ordering

- [x] 3.1 Update `src/utils/branchTree.ts` ordering logic to prioritize develop/main/stage alias families before alphabetical fallback at each tree level.
- [x] 3.2 Add or update utility-level tests (or equivalent verification) for alias matching and deterministic ordering behavior.

## 4. Validate behavior and parity

- [ ] 4.1 Verify local/remote mode switching, search filtering, and branch selection continue to work with unchanged branch action behavior.
- [ ] 4.2 Run build/typecheck verification and visually validate branch panel parity against other left-pane explorer panels.
