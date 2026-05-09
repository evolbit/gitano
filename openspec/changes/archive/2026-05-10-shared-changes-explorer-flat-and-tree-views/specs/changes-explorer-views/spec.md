## ADDED Requirements

### Requirement: Changes explorer supports flat and tree presentations
The system SHALL provide a shared changes explorer that can render changed files in flat and tree views.

#### Scenario: User views changed files in flat mode
- **WHEN** the changes explorer is set to `Flat View`
- **THEN** the explorer MUST render changed files as a flat list grouped into tracked and untracked sections
- **THEN** each file row MUST show the file name before its parent path
- **THEN** each file row MUST show insertion and deletion counts when available

#### Scenario: User views changed files in tree mode
- **WHEN** the changes explorer is set to `Tree View`
- **THEN** the explorer MUST render changed files as a filesystem tree grouped into tracked and untracked sections
- **THEN** folder rows MUST reflect the nested path structure of the changed files
- **THEN** file rows MUST remain selectable inside the rendered tree

### Requirement: Changes explorer is shared between main workspace and working-tree modal
The system SHALL use the same changes explorer model in the main workspace changes pane and the working-tree diff modal.

#### Scenario: Same file is shown in both surfaces
- **WHEN** the user opens the working-tree diff modal from the main workspace changes pane
- **THEN** both surfaces MUST present the same tracked and untracked file structure
- **THEN** the difference between the surfaces MUST be limited to enabled controls rather than a different file presentation model

### Requirement: View switching is available from a context menu
The system SHALL expose `Flat View` and `Tree View` switching from a context menu in both changes explorer surfaces.

#### Scenario: Explorer is shown before the user changes modes
- **WHEN** the changes explorer is first rendered
- **THEN** it MUST default to `Tree View`

#### Scenario: User right-clicks the main workspace changes pane
- **WHEN** the user opens the context menu in the main workspace changes pane
- **THEN** the menu MUST show `Flat View` and `Tree View`
- **THEN** choosing either option MUST switch the explorer presentation mode

#### Scenario: User right-clicks the working-tree modal changes pane
- **WHEN** the user opens the context menu in the working-tree modal changes pane
- **THEN** the menu MUST show `Flat View` and `Tree View`
- **THEN** choosing either option MUST switch the explorer presentation mode

### Requirement: Surface capabilities remain distinct
The system SHALL allow the shared explorer to expose different controls depending on where it is used.

#### Scenario: Explorer is rendered in the main workspace
- **WHEN** the shared explorer is used in the main workspace changes pane
- **THEN** file-level staging checkboxes MUST NOT be shown

#### Scenario: Explorer is rendered in the working-tree modal
- **WHEN** the shared explorer is used in the working-tree diff modal
- **THEN** file-level staging checkboxes MUST be shown for editable working-tree diffs
