## Purpose

Define how Current Changes loads and renders large working-tree change sets without requiring full diff detail for every file upfront.

## Requirements

### Requirement: Current Changes loads summaries before full diff details
The system SHALL load Current Changes file summaries without requiring full diff hunks for every changed file.

#### Scenario: Current Changes sidebar opens for a repository with many changed files
- **WHEN** the Current Changes sidebar loads for a repository with changed files
- **THEN** the initial Current Changes request MUST return enough summary data to render the file explorer
- **AND** the initial Current Changes request MUST NOT require full line-level diff hunks for every changed file

#### Scenario: Summary data renders explorer rows
- **WHEN** a Current Changes summary response is applied
- **THEN** each changed file row MUST have path, status, and available insertion/deletion counts
- **AND** each row MUST have enough staged summary data for file and folder checkbox state

#### Scenario: No file is selected for a working diff
- **WHEN** the Current Changes sidebar is visible and no working-tree diff pane is open
- **THEN** the system MUST NOT load full working-tree hunks solely to render the sidebar

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

### Requirement: Working-file diff details load lazily
The system SHALL load full working-tree diff hunks and exact staged-line state only for files that need detail-level rendering or interaction.

#### Scenario: User opens a working-tree file diff
- **WHEN** the user selects a file from Current Changes for inline diff viewing
- **THEN** the system MUST request full diff detail for that file
- **AND** the detail response MUST include the file hunks needed by the diff viewer
- **AND** the detail response MUST include exact staged-line state needed by editable line and block selection

#### Scenario: User switches selected working-tree files
- **WHEN** the user changes the selected working-tree file
- **THEN** the system MUST load detail for the newly selected file if no fresh detail is available
- **AND** stale detail for a previously selected file MUST NOT render as the new selected file

#### Scenario: Summary refresh changes a selected file
- **WHEN** a Current Changes summary refresh reports that the selected file changed
- **THEN** any cached detail for that selected file MUST be refreshed or invalidated before being treated as current

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

### Requirement: Current Changes backend work is batched where practical
The system SHALL avoid per-file backend command fan-out for Current Changes summary and staged summary loading when an equivalent batched operation is available.

#### Scenario: Summary request covers many files
- **WHEN** the backend builds a Current Changes summary for multiple files
- **THEN** it MUST prefer combined status, diff-count, and staged-summary operations over launching one Git diff command per file

#### Scenario: Batch summary parsing fails for a subset of files
- **WHEN** the backend cannot compute optional counts or staged summary for a file in the batched path
- **THEN** it MUST still return the file with safe fallback summary data
- **AND** the frontend MUST be able to request file detail later for precise diff state

### Requirement: Multi-file staging operations are bounded
The system SHALL provide bounded backend operations for folder and bulk staging workflows instead of requiring the frontend to loop one command per file.

#### Scenario: User stages a folder from the Current Changes tree
- **WHEN** the user stages all changes under a folder
- **THEN** the frontend MUST call a path-set or folder-scoped staging operation rather than sequentially staging each file from React
- **AND** the Git index MUST be updated before the UI treats the operation as confirmed

#### Scenario: User unstages a folder from the Current Changes tree
- **WHEN** the user unstages all changes under a folder
- **THEN** the frontend MUST call a path-set or folder-scoped unstage operation rather than sequentially unstaging each file from React
- **AND** the staged summary MUST refresh after the operation

### Requirement: Current Changes rendering work is bounded for large inputs
The system SHALL keep Current Changes list and selected diff rendering bounded for large changed-file sets and large selected diffs.

#### Scenario: Current Changes contains more rows than fit onscreen
- **WHEN** the changed-file explorer contains more rows than fit in the visible pane
- **THEN** the explorer MUST render only the visible row range plus a bounded overscan range
- **AND** selection, context menus, and scroll restoration MUST continue to use stable file paths

#### Scenario: Current Changes is in tree view
- **WHEN** the changed-file explorer renders tree folders
- **THEN** folder descendant and aggregate staged state needed for rendering MUST be precomputed or memoized outside individual folder row render work

#### Scenario: Selected file has a very large diff
- **WHEN** a selected working-tree file has more diff lines than can be mounted responsively
- **THEN** the diff viewer MUST avoid mounting the entire file diff at once
- **AND** the user MUST still be able to inspect and stage visible supported lines or blocks

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
