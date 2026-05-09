## 1. Backend Branch-Relative History

- [x] 1.1 Add backend logic to infer a candidate base branch for the selected branch and compute the merge-base between them.
- [x] 1.2 Update commit history retrieval so it returns commits reachable from the selected branch that are not reachable from the inferred base branch.
- [x] 1.3 Add support for `First parent` and `Everything` history modes on top of the branch-relative commit scope.

## 2. Commit History API Shape

- [x] 2.1 Extend the commit history response so the frontend receives the inferred base branch together with the commit rows.
- [x] 2.2 Update the commit history request contract so the frontend can specify the selected history mode when reloading commits.

## 3. Commit Table Controls

- [x] 3.1 Update `src/components/CommitList.tsx` to replace the current top-bar actions with a branch-history control strip that keeps the search box and adds a history mode selector.
- [x] 3.2 Remove the `Filtros` and `Añadir manualmente` buttons from the commit table UI.
- [x] 3.3 Show the inferred base branch in the commit table controls so the branch-relative comparison context is visible.

## 4. Reload and Verification

- [x] 4.1 Reset commit pagination and selected commit state when branch selection or history mode changes before reloading data from the backend.
- [x] 4.2 Verify that branch-relative history differs from raw branch-tip ancestry, that both history modes reload correctly, and that the simplified control strip still behaves correctly.
