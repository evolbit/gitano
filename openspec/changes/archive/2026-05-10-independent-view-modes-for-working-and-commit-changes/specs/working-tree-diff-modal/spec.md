## MODIFIED Requirements

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
