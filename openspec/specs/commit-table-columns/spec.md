## Purpose

Define which metadata columns and payload fields are part of the commit list experience.

## Requirements

### Requirement: Commit list omits incomplete pull request, merge target, and CI fields
The commit list workflow SHALL omit `pr`, `merged_in`, and `ci` from both the visible UI and the commit list data contract until that functionality is implemented correctly.

#### Scenario: Commit table header is rendered
- **WHEN** the commit list table is shown for any repository
- **THEN** the visible headers MUST NOT include `PR`
- **THEN** the visible headers MUST NOT include `Mergeado en`
- **THEN** the visible headers MUST NOT include `CI`

#### Scenario: Commit rows are rendered
- **WHEN** commit rows are displayed in the commit list
- **THEN** each row MUST omit cells for `pr` and `merged_in`
- **THEN** each row MUST omit cells for `ci`
- **THEN** the remaining commit columns MUST continue rendering in their configured order

#### Scenario: Commit list payload is produced
- **WHEN** the Tauri backend serializes commit list items for the frontend
- **THEN** each commit item MUST NOT include `pr`
- **THEN** each commit item MUST NOT include `merged_in`
- **THEN** each commit item MUST NOT include `ci`

### Requirement: Commit list behavior remains unchanged apart from removed fields
The system SHALL preserve existing commit list interactions while removing the incomplete `pr`, `merged_in`, and `ci` fields.

#### Scenario: User navigates the commit list
- **WHEN** the user scrolls, selects rows, or uses keyboard navigation in the commit list
- **THEN** commit loading, virtualization, and row selection behavior MUST continue to operate as before
