## Purpose

Define how the commit changes pane renders changed files using the shared explorer model, including its persisted view mode and narrow-pane behavior.

## Requirements
### Requirement: Commit changes pane uses the shared changes explorer
The system SHALL render the commit changes file list using the shared changes explorer model rather than a flat-only legacy list.

#### Scenario: User reopens a repository after changing commit changes view mode
- **WHEN** the user previously changed the commit changes pane between `Flat View` and `Tree View`
- **THEN** the system MUST restore that commit changes view mode for the same repository

#### Scenario: Commit tree is rendered in a narrow pane
- **WHEN** the commit changes pane is in `Tree View` and the file list becomes narrow
- **THEN** tree rows MUST preserve fixed chevron and folder icon slots
- **THEN** tree labels MUST truncate before the chevron or folder icon visibly shrinks

### Requirement: Commit changes count alignment matches panel controls
The system SHALL align insertion/deletion counts in commit changes rows with the right-side controls in the commit changes panel.

#### Scenario: File counts align with view buttons
- **WHEN** commit changes file rows are rendered
- **THEN** the insertion/deletion count column MUST include enough right-side padding to visually align with the panel action buttons

#### Scenario: Count padding preserves truncation
- **WHEN** the commit changes pane is narrow
- **THEN** file name/path text MUST truncate before overlapping the count column
- **AND** count padding MUST NOT shrink status icons, count values, or optional checkboxes
