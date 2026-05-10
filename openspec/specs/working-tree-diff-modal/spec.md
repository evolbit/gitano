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

