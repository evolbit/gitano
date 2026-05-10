## 1. Persistence Store

- [x] 1.1 Add a dedicated persisted workspace/UI store for window bounds and per-repo workspace UI state.
- [x] 1.2 Define a per-repo state model keyed by `repoPath` for durable workspace preferences.

## 2. Window Persistence

- [x] 2.1 Persist window bounds when the user resizes or moves the app window.
- [x] 2.2 Restore persisted window bounds on startup while clamping to configured minimum constraints.

## 3. Workspace Preference Persistence

- [x] 3.1 Persist and restore left sidebar accordion open sections per repository.
- [x] 3.2 Persist and restore working-tree changes view mode per repository.
- [x] 3.3 Persist and restore commit changes view mode per repository.
- [x] 3.4 Persist and restore durable branch tree expansion state per repository.
- [x] 3.5 Persist and restore durable main changes explorer expansion state per repository.
- [x] 3.6 Persist and restore main workspace pane widths per repository.

## 4. Verification

- [x] 4.1 Verify open tabs and active repository still restore correctly.
- [x] 4.2 Verify window size/position restore correctly after relaunch.
- [x] 4.3 Verify per-repo sidebar, pane, and explorer preferences restore independently between repositories.
- [x] 4.4 Verify transient state such as searches and menus does not restore.
