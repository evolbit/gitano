## ADDED Requirements

### Requirement: Lazy detail loading preserves external staged-state synchronization
The system SHALL preserve synchronization with the real Git index even when exact staged-line details are loaded lazily.

#### Scenario: External partial line staging exists before file detail loads
- **WHEN** one or more lines in a modified file are staged outside Gitano
- **AND** Current Changes loads only the summary for that file
- **THEN** the file and folder staged summary MUST indicate that the file is partially staged
- **AND** the exact staged lines MUST appear selected after the user opens that file's working-tree diff detail

#### Scenario: External whole-file staging exists before file detail loads
- **WHEN** a modified file is fully staged outside Gitano
- **AND** Current Changes loads only the summary for that file
- **THEN** the file checkbox MUST appear checked from summary data
- **AND** the working-tree diff detail MUST render the file as fully selected when opened

#### Scenario: External unstaging occurs while detail is cached
- **WHEN** a file has cached working-tree diff detail in Gitano
- **AND** the file is unstaged outside Gitano
- **AND** Current Changes refreshes
- **THEN** the cached detail MUST be invalidated or updated before it is used for editable staged-line rendering
