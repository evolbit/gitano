## 1. Rename shared git-action state surface

- [x] 1.1 Rename the shared action state module and exported hook/API from `remote` terminology to `git action` terminology.
- [x] 1.2 Update the state interface field/setter names (`notice`, `pending`, and setters) to the new naming contract while keeping value semantics unchanged.

## 2. Update toolbar and commit-bar integrations

- [x] 2.1 Update `src/components/top-toolbar/TopToolbar.tsx` selectors, local variables, helper names, and timeout references to use the renamed store API.
- [x] 2.2 Update `src/components/current-changes-commit-bar/CurrentChangesCommitBar.tsx` to use the renamed setter/selectors for push/stash feedback.

## 3. Validate behavior and consistency

- [x] 3.1 Run a repository-wide search to confirm old `remote notice` naming no longer appears in the shared feedback path.
- [x] 3.2 Run typecheck/build verification to ensure imports and references compile after rename.
- [ ] 3.3 Manually verify pull/push/fetch and stash feedback still shows the same snackbar behavior (success, error, details toggle, dismissal timing).
