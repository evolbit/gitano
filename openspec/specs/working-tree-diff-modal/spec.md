## Purpose

Define how working-tree file diffs open and behave in the modal diff inspector, including navigation, deleted-file handling, and dismissal behavior.
## Requirements
### Requirement: Working-tree file diffs open in a modal
The system SHALL present working-tree file diffs as an inline right-workspace replacement instead of opening a modal above the repository workspace.

#### Scenario: User opens a working-tree file diff
- **WHEN** the user opens a changed working-tree file from the repo workspace
- **THEN** the system MUST replace the entire right workspace with an inline diff viewer
- **THEN** the current changes pane MUST remain visible beside the diff viewer
- **THEN** the system MUST NOT open a modal above the workspace

### Requirement: Working-tree diff modal mirrors the committed-file modal layout
The system SHALL keep working-tree inline diff presentation synchronized with the current changes pane view mode and shared diff controls.

#### Scenario: User opens the working-tree diff from a pane with tree view active
- **WHEN** the current working changes pane is in `Tree View`
- **AND** the user opens a working-tree inline diff from that pane
- **THEN** the inline diff viewer MUST open using `Tree View` for any shared file-navigation presentation

#### Scenario: User opens the working-tree diff from a pane with flat view active
- **WHEN** the current working changes pane is in `Flat View`
- **AND** the user opens a working-tree inline diff from that pane
- **THEN** the inline diff viewer MUST open using `Flat View` for any shared file-navigation presentation

#### Scenario: User changes the working-tree diff view mode
- **WHEN** the user changes the working-tree diff between `Flat View` and `Tree View`
- **THEN** the current working changes pane MUST adopt the same mode
- **THEN** the commit changes pane MUST NOT change modes as a side effect

### Requirement: Working-tree diff modal supports keyboard dismissal
The system SHALL allow users to close the working-tree inline diff viewer with the keyboard.

#### Scenario: User presses escape while the inline diff is open
- **WHEN** the working-tree inline diff viewer is open and the user presses `Esc`
- **THEN** the inline diff viewer MUST close
- **THEN** the repository workspace MUST restore the normal history panes with their persisted selection state

### Requirement: Working-tree diff modal follows live working changes while open
The system SHALL keep the working-tree inline diff synchronized with the same live working-changes source used by the current-changes sidebar.

#### Scenario: Working changes refresh while the inline diff is open
- **WHEN** the repository working changes are refreshed while a working-tree inline diff is open
- **THEN** the diff target MUST update to reflect the refreshed working changes
- **THEN** the system MUST continue showing the selected file if a file with the same path still exists after the refresh

#### Scenario: New working-change file appears while the inline diff is open
- **WHEN** a new working-change file is detected while a working-tree inline diff is open
- **THEN** that file MUST appear in the current changes pane without closing and reopening the diff
- **THEN** newly detected untracked files MUST be grouped the same way they are in the main current-changes sidebar

#### Scenario: Selected file disappears while the inline diff is open
- **WHEN** the currently selected working-tree file is no longer present in the refreshed working changes
- **THEN** the system MUST close the inline diff or clear the working-tree diff selection rather than keeping a stale selected file view

#### Scenario: Selected file still exists after refresh
- **WHEN** the currently selected working-tree file still exists after a working-changes refresh
- **THEN** the inline diff MUST preserve selection by file path
- **THEN** the diff viewer MUST rebind to the refreshed file entry for that path

### Requirement: Inline working diff loads selected-file detail independently from the sidebar summary
The system SHALL allow the inline working-tree diff viewer to load full selected-file detail independently from the Current Changes sidebar summary response.

#### Scenario: User opens an inline working diff from summary data
- **WHEN** the user selects a Current Changes file whose summary is loaded but whose full hunks are not loaded
- **THEN** the inline working diff pane MUST request full detail for that selected file
- **AND** the Current Changes sidebar MUST remain visible and usable while detail loads

#### Scenario: Working changes refresh while inline diff is open
- **WHEN** Current Changes summary refreshes while an inline working diff is open
- **AND** the selected file still exists
- **THEN** the inline diff MUST preserve selection by file path
- **AND** the selected file detail MUST be refreshed or validated against the latest summary before being treated as current

#### Scenario: Selected file disappears after summary refresh
- **WHEN** Current Changes summary refreshes while an inline working diff is open
- **AND** the selected file no longer exists in the summary
- **THEN** the inline diff MUST close or clear the selected working diff path
- **AND** stale cached detail for that file MUST NOT remain visible as current data
