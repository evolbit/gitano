## ADDED Requirements

### Requirement: Working-tree file diffs open in a modal
The system SHALL present working-tree file diffs in a modal instead of replacing the main repo workspace with an inline diff view.

#### Scenario: User opens a working-tree file diff
- **WHEN** the user opens a changed working-tree file from the repo workspace
- **THEN** the system MUST open a modal for diff inspection
- **THEN** the main repo workspace MUST remain visible underneath the modal
- **THEN** the system MUST NOT replace the main workspace content with an inline diff view

### Requirement: Working-tree diff modal mirrors the committed-file modal layout
The system SHALL use the same two-pane modal pattern for working-tree files that it already uses for committed-file diff inspection.

#### Scenario: Working-tree diff modal is rendered
- **WHEN** a working-tree diff modal is shown
- **THEN** the left pane MUST show the changed working-tree file list
- **THEN** the right pane MUST show the selected file diff and hunks
- **THEN** the modal MUST open with the user-selected file as the initial file

#### Scenario: User navigates between working-tree files in the modal
- **WHEN** the user selects another changed file from the modal file list
- **THEN** the right pane MUST update to show that file's working-tree diff
- **THEN** the modal MUST remain open while navigating between files

### Requirement: Working-tree diff modal supports keyboard dismissal
The system SHALL allow users to close the working-tree diff modal with the keyboard.

#### Scenario: User presses escape while the modal is open
- **WHEN** the working-tree diff modal is open and the user presses `Esc`
- **THEN** the modal MUST close
- **THEN** the underlying repo workspace MUST remain in its prior state
