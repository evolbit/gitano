## 1. Workspace state updates

- [x] 1.1 Replace the persisted left accordion state with a persisted active left-pane section in the workspace UI store
- [x] 1.2 Update default repository workspace state to initialize the left pane to the `changes` section

## 2. Left pane shell migration

- [x] 2.1 Replace the accordion container in `RepoTabLayout` with a single active section shell and bottom navigation bar
- [x] 2.2 Render contextual headers and active bodies for `Changes`, `Branches`, and `Folders` inside the new shell
- [x] 2.3 Preserve existing left pane resize behavior and section content switching without disturbing the main split layout

## 3. Section content polish

- [x] 3.1 Adjust `BranchList` shell spacing or framing only as needed to fit the new left-pane container
- [x] 3.2 Verify `ChangesExplorer` still fits the left pane cleanly under the new header and bottom navigation layout
- [x] 3.3 Validate repository-scoped restoration of the selected left-pane section after switching repositories or reopening a repository
