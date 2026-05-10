## Purpose

Define how working-tree file diffs open and behave in the modal diff inspector, including navigation, deleted-file handling, and dismissal behavior.
## Requirements
### Requirement: Working-tree file diffs open in a modal
The system SHALL present working-tree file diffs in a modal instead of replacing the main repo workspace with an inline diff view.

#### Scenario: User opens a working-tree file diff
- **WHEN** the user opens a changed working-tree file from the repo workspace
- **THEN** the system MUST open a modal for diff inspection
- **THEN** the main repo workspace MUST remain visible underneath the modal
- **THEN** the system MUST NOT replace the main workspace content with an inline diff view

### Requirement: Working-tree diff modal mirrors the committed-file modal layout
The system SHALL use the same two-pane modal pattern for working-tree files that it already uses for committed-file diff inspection.

#### Scenario: User opens the working-tree modal from a pane with tree view active
- **WHEN** the current working changes pane is in `Tree View`
- **AND** the user opens a working-tree diff modal from that pane
- **THEN** the modal MUST open in `Tree View`

#### Scenario: User opens the working-tree modal from a pane with flat view active
- **WHEN** the current working changes pane is in `Flat View`
- **AND** the user opens a working-tree diff modal from that pane
- **THEN** the modal MUST open in `Flat View`

#### Scenario: User changes the working-tree modal view mode
- **WHEN** the user changes the working-tree modal between `Flat View` and `Tree View`
- **THEN** the current working changes pane MUST adopt the same mode
- **THEN** the commit changes pane MUST NOT change modes as a side effect

### Requirement: Working-tree diff modal supports keyboard dismissal
The system SHALL allow users to close the working-tree diff modal with the keyboard.

#### Scenario: User presses escape while the modal is open
- **WHEN** the working-tree diff modal is open and the user presses `Esc`
- **THEN** the modal MUST close
- **THEN** the underlying repo workspace MUST remain in its prior state

### Requirement: Working-tree diff modal follows live working changes while open
The system SHALL keep the working-tree diff modal synchronized with the same live working-changes source used by the current-changes sidebar.

#### Scenario: Working changes refresh while the modal is open
- **WHEN** the repository working changes are refreshed while a working-tree diff modal is open
- **THEN** the modal file list MUST update to reflect the refreshed working changes
- **THEN** the modal MUST continue showing the selected file if a file with the same path still exists in the refreshed changes

#### Scenario: New working-change file appears while the modal is open
- **WHEN** a new working-change file is detected while the working-tree diff modal is open
- **THEN** that file MUST appear in the modal file list without closing and reopening the modal
- **THEN** newly detected untracked files MUST be grouped the same way they are in the main current-changes sidebar

#### Scenario: Selected file disappears while the modal is open
- **WHEN** the currently selected working-tree file is no longer present in the refreshed working changes
- **THEN** the modal MUST close or clear the working-tree selection rather than keeping a stale selected file view

#### Scenario: Selected file still exists after refresh
- **WHEN** the currently selected working-tree file still exists after a working-changes refresh
- **THEN** the modal MUST preserve selection by file path
- **THEN** the right-pane diff MUST rebind to the refreshed file entry for that path
