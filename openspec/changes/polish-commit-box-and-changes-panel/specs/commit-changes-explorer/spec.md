## ADDED Requirements

### Requirement: Commit changes count alignment matches panel controls

The system SHALL align insertion/deletion counts in commit changes rows with the right-side controls in the commit changes panel.

#### Scenario: File counts align with view buttons

- **WHEN** commit changes file rows are rendered
- **THEN** the insertion/deletion count column MUST include enough right-side padding to visually align with the panel action buttons

#### Scenario: Count padding preserves truncation

- **WHEN** the commit changes pane is narrow
- **THEN** file name/path text MUST truncate before overlapping the count column
- **AND** count padding MUST NOT shrink status icons, count values, or optional checkboxes
