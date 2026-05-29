# external-index-staging-sync Specification

## Purpose
TBD - created by archiving change sync-external-index-staging-into-diff-viewer. Update Purpose after archive.
## Requirements
### Requirement: Current-changes diff viewer reflects staged state from the Git index
The system SHALL show staged line, block, and file selection in the current-changes diff viewer based on the real Git index, including changes staged outside Gitano.

#### Scenario: User stages lines externally
- **WHEN** the user stages one or more lines in a modified file using an external Git tool
- **AND** the working changes are refreshed in Gitano
- **THEN** the current-changes diff viewer MUST show those staged lines as selected
- **THEN** the corresponding block and file selection state MUST reflect that staged subset

#### Scenario: User stages a whole file externally
- **WHEN** the user stages the full contents of a modified file using an external Git tool
- **AND** the working changes are refreshed in Gitano
- **THEN** the file checkbox MUST appear checked
- **THEN** the diff viewer MUST render the file as fully selected using the existing whole-file staged behavior

#### Scenario: User stages a new file externally
- **WHEN** the user stages an untracked file using an external Git tool
- **AND** the working changes are refreshed in Gitano
- **THEN** the file MUST appear staged in the current-changes file list
- **THEN** the working-tree modal and file checkbox state MUST match that staged state

#### Scenario: User unstages externally
- **WHEN** the user unstages previously staged current changes using an external Git tool
- **AND** the working changes are refreshed in Gitano
- **THEN** the current-changes file and diff selection visuals MUST update to remove the staged state that no longer exists in the index

### Requirement: External index staging sync preserves diff interaction responsiveness
The system SHALL synchronize external staged state without adding render-time Git work or materially degrading current-changes diff interaction performance.

#### Scenario: Diff viewer renders after staged-state sync
- **WHEN** the current-changes diff viewer renders after external staged-state synchronization
- **THEN** the viewer MUST consume normalized staged selection state from memory
- **THEN** the viewer MUST NOT compute staged Git diffs during row or hunk rendering

#### Scenario: Fully staged file is synchronized
- **WHEN** external staged-state synchronization determines that the full editable diff for a file is staged
- **THEN** the system MUST preserve a lightweight whole-file staged representation
- **THEN** it MUST NOT require explicit per-line staged entries solely to render that fully staged state

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
