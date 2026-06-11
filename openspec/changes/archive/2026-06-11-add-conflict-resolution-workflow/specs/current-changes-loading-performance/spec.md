## ADDED Requirements

### Requirement: Current Changes loads conflict summaries before conflict details
The system SHALL load unresolved conflict summaries without requiring full conflict file content upfront.

#### Scenario: Current Changes sidebar opens with conflicts
- **WHEN** the Current Changes sidebar loads for a repository with unresolved conflicts
- **THEN** the initial Current Changes request MUST return enough summary data to render conflict rows
- **AND** the initial request MUST NOT require full base, current, incoming, or result content for every conflicted file

#### Scenario: Conflict summary renders explorer rows
- **WHEN** a conflict summary response is applied
- **THEN** each conflict row MUST have path, conflict state, available conflict count or fallback metadata, and a stable file signature
- **AND** each row MUST have enough metadata to disable normal staging controls before detail loading

### Requirement: Conflict file details load lazily
The system SHALL load conflict file detail only for files that need conflict resolution rendering or interaction.

#### Scenario: User opens a conflict file
- **WHEN** the user selects a conflicted file from Current Changes
- **THEN** the system MUST request conflict detail for that file
- **AND** the detail response MUST include the data needed by the conflict resolution surface for the selected file only

#### Scenario: Summary refresh changes selected conflict
- **WHEN** a Current Changes summary refresh reports that the selected conflicted file changed
- **THEN** any cached conflict detail for that file MUST be refreshed or invalidated before being treated as current

#### Scenario: User switches conflict files
- **WHEN** the user selects another conflicted file
- **THEN** stale detail for the previously selected conflict MUST NOT render as the newly selected conflict

### Requirement: Conflict content rendering is bounded for large inputs
The system SHALL keep conflict context and result rendering responsive for large and very large text files.

#### Scenario: Large conflict file is opened
- **WHEN** a selected conflict file has more than 5,000 lines or more than 1 MB in any rendered text version
- **THEN** the read-only conflict context panes MUST render only the visible row range plus bounded overscan
- **AND** conflict navigation MUST continue to use stable line and conflict-region anchors

#### Scenario: Very large conflict file is opened
- **WHEN** a selected conflict file has more than 50,000 lines or more than 10 MB in any rendered text version
- **THEN** the backend MUST support loading bounded line ranges for read-only context panes
- **AND** the frontend MUST avoid mounting the entire read-only file content at once

#### Scenario: Very large result file is not safe for Monaco editing
- **WHEN** the result content exceeds the configured editable text threshold
- **THEN** the UI MUST avoid mounting Monaco for that result
- **AND** the UI MUST provide external-editor guidance or a bounded fallback action
