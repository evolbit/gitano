## MODIFIED Requirements

### Requirement: View switching is available from a context menu
The system SHALL expose `Flat View` and `Tree View` switching from a context menu in both changes explorer surfaces.

#### Scenario: Explorer is shown before the user changes modes
- **WHEN** the changes explorer is first rendered in a pane
- **THEN** it MUST default to `Tree View`

#### Scenario: User changes the working-tree pane view mode
- **WHEN** the user switches the current working changes pane between `Flat View` and `Tree View`
- **THEN** the working-tree changes pane MUST keep that selected mode
- **THEN** the commit changes pane MUST NOT change modes as a side effect

#### Scenario: User changes the commit changes pane view mode
- **WHEN** the user switches the commit changes pane between `Flat View` and `Tree View`
- **THEN** the commit changes pane MUST keep that selected mode
- **THEN** the working-tree changes pane MUST NOT change modes as a side effect
