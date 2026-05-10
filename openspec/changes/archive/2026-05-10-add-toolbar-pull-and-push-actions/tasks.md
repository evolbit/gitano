## 1. Toolbar Remote Actions

- [x] 1.1 Make the `Pull` toolbar control execute a backend remote operation for the active repository.
- [x] 1.2 Make the `Push` toolbar control execute a backend push for the active repository.
- [x] 1.3 Make the full `Pull` and `Push` tiles clickable instead of limiting interaction to the icon.

## 2. Pull Strategy Selection

- [x] 2.1 Add a split-button/dropdown interaction for `Pull`.
- [x] 2.2 Add the supported default pull/fetch strategies to that menu.
- [x] 2.3 Persist the selected pull strategy globally across repositories and restarts.

## 3. Error Feedback

- [x] 3.1 Add a compact bottom snackbar for toolbar remote-operation failures.
- [x] 3.2 Support expanding the snackbar to reveal full backend error details.

## 4. Visual and Behavioral Verification

- [x] 4.1 Add hover affordances/tooltips for the toolbar remote action tiles.
- [x] 4.2 Verify the selected pull strategy is reused in a different repository tab and after app restart.
- [x] 4.3 Verify pull/push failures surface in the snackbar and do not block the rest of the workspace.
