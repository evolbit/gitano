## ADDED Requirements

### Requirement: Diff source content uses Monaco-backed syntax rendering
The system SHALL render shared diff source content through read-only Monaco-backed code surfaces while preserving Gitano's parsed diff line identities.

#### Scenario: Unified diff uses Monaco source rendering
- **WHEN** the diff viewer is set to `Unified`
- **THEN** the system MUST render source code content with the registered Gitano Monaco theme
- **AND** old and new line-number gutters MUST remain aligned with the same logical diff rows
- **AND** staging gutters and review-line anchors MUST remain tied to the existing `hunkIdx` and `lineIdx` identities

#### Scenario: Split diff uses Monaco source rendering
- **WHEN** the diff viewer is set to `Split`
- **THEN** the system MUST render old-side and new-side source content with the registered Gitano Monaco theme
- **AND** the system MUST preserve the existing split-row pairing from the parsed hunk data
- **AND** staging gutters and review-line anchors MUST remain tied to the same logical diff lines as unified mode

#### Scenario: Inline changed text is highlighted over Monaco content
- **WHEN** comparable added and deleted lines have exact changed-text ranges
- **THEN** the system MUST apply the existing stronger green or red inline changed-text emphasis to those ranges
- **AND** Monaco token coloring MUST NOT remove or replace the row-level add/delete tone

#### Scenario: Monaco cannot render a language or fails to load
- **WHEN** Monaco does not have a useful language mapping for the file or the editor surface fails to load
- **THEN** the diff viewer MUST still render readable source content
- **AND** line selection, block selection, context expansion, and review/comment anchors MUST remain usable
