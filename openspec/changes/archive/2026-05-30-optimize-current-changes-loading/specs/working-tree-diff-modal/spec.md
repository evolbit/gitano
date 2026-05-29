## ADDED Requirements

### Requirement: Inline working diff loads selected-file detail independently from the sidebar summary
The system SHALL allow the inline working-tree diff viewer to load full selected-file detail independently from the Current Changes sidebar summary response.

#### Scenario: User opens an inline working diff from summary data
- **WHEN** the user selects a Current Changes file whose summary is loaded but whose full hunks are not loaded
- **THEN** the inline working diff pane MUST request full detail for that selected file
- **AND** the Current Changes sidebar MUST remain visible and usable while detail loads

#### Scenario: Working changes refresh while inline diff is open
- **WHEN** Current Changes summary refreshes while an inline working diff is open
- **AND** the selected file still exists
- **THEN** the inline diff MUST preserve selection by file path
- **AND** the selected file detail MUST be refreshed or validated against the latest summary before being treated as current

#### Scenario: Selected file disappears after summary refresh
- **WHEN** Current Changes summary refreshes while an inline working diff is open
- **AND** the selected file no longer exists in the summary
- **THEN** the inline diff MUST close or clear the selected working diff path
- **AND** stale cached detail for that file MUST NOT remain visible as current data
