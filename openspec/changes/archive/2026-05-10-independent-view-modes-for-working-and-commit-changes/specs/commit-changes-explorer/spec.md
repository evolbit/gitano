## ADDED Requirements

### Requirement: Commit changes pane uses the shared changes explorer
The system SHALL render the commit changes file list using the shared changes explorer model rather than a flat-only legacy list.

#### Scenario: Commit changes pane renders file structure
- **WHEN** the user views the changed files for a selected commit
- **THEN** the pane MUST support both `Flat View` and `Tree View`
- **THEN** the file list MUST use the shared changes explorer component
- **THEN** file-level staging checkboxes MUST NOT be shown

#### Scenario: User opens a commit diff modal from tree view
- **WHEN** the commit changes pane is in `Tree View`
- **AND** the user opens a file diff modal from that pane
- **THEN** the modal MUST open in `Tree View`

#### Scenario: User opens a commit diff modal from flat view
- **WHEN** the commit changes pane is in `Flat View`
- **AND** the user opens a file diff modal from that pane
- **THEN** the modal MUST open in `Flat View`

#### Scenario: User changes the commit modal view mode
- **WHEN** the user changes the commit diff modal between `Flat View` and `Tree View`
- **THEN** the commit changes pane MUST adopt the same mode
- **THEN** the working-tree changes pane MUST NOT change modes as a side effect
