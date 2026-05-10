## Purpose

Define how the shared changes explorer presents changed files across the main workspace and working-tree modal, including supported view modes and surface-specific controls.
## Requirements
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

#### Scenario: Selected file is initially outside the visible area in flat mode
- **WHEN** the diff modal opens in `Flat View` and the selected file row is outside the visible portion of the left pane
- **THEN** the explorer MUST scroll the left pane so that selected file becomes visible

#### Scenario: Selected file is initially outside the visible area in tree mode
- **WHEN** the diff modal opens in `Tree View` and the selected file row is outside the visible portion of the left pane
- **THEN** the explorer MUST expand the selected file's ancestor folders
- **THEN** the explorer MUST scroll the left pane so that selected file becomes visible

### Requirement: View switching is available from a context menu
The system SHALL expose `Flat View` and `Tree View` switching from a context menu in both changes explorer surfaces.

#### Scenario: User reopens a repository after changing explorer modes
- **WHEN** the user previously changed the working changes or commit changes explorer mode for a repository
- **THEN** the system MUST restore those view modes independently for that repository

#### Scenario: User reopens a repository after changing tree expansion
- **WHEN** the user previously expanded or collapsed durable tree groups in the main workspace explorer for a repository
- **THEN** the system MUST restore that durable expansion state for the same repository

### Requirement: Surface capabilities remain distinct
The system SHALL allow the shared explorer to expose different controls depending on where it is used.

#### Scenario: Explorer is rendered in the main workspace
- **WHEN** the shared explorer is used in the main workspace changes pane
- **THEN** file-level staging checkboxes MUST NOT be shown

#### Scenario: Explorer is rendered in the working-tree modal
- **WHEN** the shared explorer is used in the working-tree diff modal
- **THEN** file-level staging checkboxes MUST be shown for editable working-tree diffs

