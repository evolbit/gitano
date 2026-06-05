## ADDED Requirements

### Requirement: Current Changes exposes unresolved merge conflicts
The system SHALL expose unresolved Git conflicts as first-class Current Changes entries.

#### Scenario: Repository has unresolved conflicts
- **WHEN** the repository index contains unmerged entries
- **THEN** Current Changes MUST show each conflicted path in a dedicated `Conflicts` section
- **AND** each conflicted row MUST use a `conflicted` state instead of being normalized to `modified`
- **AND** the `Conflicts` section MUST appear before normal tracked and untracked sections

#### Scenario: Conflict row is unresolved
- **WHEN** a conflicted row is rendered
- **THEN** normal file staging checkboxes and line-staging actions MUST NOT be available for that row
- **AND** the row MUST show enough conflict metadata for the user to distinguish it from an ordinary modified file

#### Scenario: Conflict is resolved externally
- **WHEN** a Current Changes refresh no longer reports a selected file as conflicted
- **THEN** the conflict row MUST disappear from the `Conflicts` section
- **AND** the conflict resolution surface MUST close or move to the next remaining conflict

### Requirement: Conflict detail uses Git index stages as source of truth
The system SHALL load conflict detail from Git's unmerged index stages and the current worktree result.

#### Scenario: Text conflict detail loads
- **WHEN** the user opens a conflicted text file
- **THEN** the backend MUST return available base, current, incoming, and result content
- **AND** stage 2 content MUST be labeled `Current`
- **AND** stage 3 content MUST be labeled `Incoming`
- **AND** the response MUST include conflict regions, conflict kind metadata, line counts, byte sizes, line-ending metadata, and validation signatures

#### Scenario: Base stage is missing
- **WHEN** a conflict has no base stage
- **THEN** the detail response MUST represent the base side as unavailable
- **AND** the UI MUST still render available current, incoming, and result content where text content exists

#### Scenario: Conflict has non-text content
- **WHEN** a conflicted path is binary, a symlink, a submodule, or otherwise unsupported for text editing
- **THEN** the detail response MUST identify the content kind
- **AND** the UI MUST avoid rendering a text merge editor for that path

### Requirement: Selecting a conflicted file opens conflict resolution
The system SHALL open a dedicated conflict resolution surface when the user selects a conflicted file from Current Changes.

#### Scenario: User opens a conflict file
- **WHEN** the user selects a conflicted file row
- **THEN** the repository right workspace MUST switch to conflict resolution mode for that file
- **AND** the Current Changes pane MUST remain visible as the conflict navigator
- **AND** normal history and normal working-diff pane state MUST remain preserved for restoration

#### Scenario: User closes conflict resolution
- **WHEN** the user closes the conflict resolution surface
- **THEN** the system MUST restore the normal right workspace layout
- **AND** the selected commit and Current Changes state MUST remain preserved

#### Scenario: User navigates conflicts
- **WHEN** multiple conflict regions or conflicted files exist
- **THEN** the conflict surface MUST provide previous/next navigation
- **AND** navigation MUST keep the active conflict region visible in the read-only panes and result panel

### Requirement: Conflict resolution shows read-only context panes and editable result
The system SHALL render read-only incoming/current context panes above a single editable result panel for supported text conflicts.

#### Scenario: Supported text conflict renders
- **WHEN** a supported conflicted text file is open
- **THEN** the top-left pane MUST show read-only `Incoming` full-file context
- **AND** the top-right pane MUST show read-only `Current` full-file context
- **AND** the bottom panel MUST show an editable `Result` projection based on the worktree result
- **AND** unresolved regions in the `Result` projection MUST show base/no-change content when a base stage is available
- **AND** conflicts without a base stage MUST fall back to the raw worktree result content
- **AND** conflict regions MUST be highlighted in all panes where matching context is available

#### Scenario: Result projection needs visual alignment rows
- **WHEN** unresolved result content has fewer visible lines than either side's conflict content
- **THEN** the result panel MUST use display-only empty alignment rows to preserve visual correspondence
- **AND** those rows MUST NOT be written to the worktree result file

#### Scenario: Conflict surface opens
- **WHEN** conflict detail is ready
- **THEN** the surface MUST scroll to the selected or first unresolved conflict region
- **AND** the user MUST be able to inspect full file context without losing the active conflict focus

#### Scenario: Top panes are read-only
- **WHEN** the user interacts with the `Incoming` or `Current` panes
- **THEN** the panes MUST NOT allow direct editing
- **AND** side acceptance actions MUST update the `Result` content rather than modifying side content

### Requirement: Result editing uses lazy-loaded Monaco for supported text files
The system SHALL use a lazy-loaded Monaco editor only for the editable conflict result panel.

#### Scenario: Supported result editor opens
- **WHEN** a supported text conflict result panel is rendered
- **THEN** the app MUST lazy-load `@monaco-editor/react`
- **AND** Monaco MUST be mounted only for the result editor
- **AND** the editor language MUST be inferred from the file path when possible

#### Scenario: User edits result content
- **WHEN** the user changes result content in the editor
- **THEN** the surface MUST track dirty state
- **AND** the user MUST be able to save the result content to the worktree file

#### Scenario: User marks file resolved
- **WHEN** the user marks a conflict file resolved
- **THEN** the system MUST save any pending result edits or require the user to address unsaved edits
- **AND** unresolved no-change/base-projection regions MUST block mark-resolved until accepted, edited, or otherwise replaced
- **AND** the backend MUST mark the file resolved through the Git index after validating the expected conflict signature

### Requirement: Conflict actions update the result safely
The system SHALL provide conflict-specific actions that update the result content without bypassing conflict validation.

#### Scenario: User accepts incoming for a conflict region
- **WHEN** the user chooses to accept incoming content for a conflict region
- **THEN** the system MUST update the result content for that region with the incoming candidate content
- **AND** the action MUST validate that the loaded conflict signature is still current before saving or applying

#### Scenario: User accepts current for a conflict region
- **WHEN** the user chooses to accept current content for a conflict region
- **THEN** the system MUST update the result content for that region with the current candidate content
- **AND** the action MUST validate that the loaded conflict signature is still current before saving or applying

#### Scenario: Side acceptance is unsupported
- **WHEN** the conflict kind does not support direct side acceptance
- **THEN** the UI MUST disable or omit the unsupported side action
- **AND** the UI MUST still provide manual result editing or external-editor guidance when available

### Requirement: Conflict writes reject stale state
The system SHALL prevent stale conflict details or AI candidates from overwriting newer worktree or index state.

#### Scenario: Worktree result changed externally
- **WHEN** the user saves result content with an expected result signature that no longer matches the current file
- **THEN** the backend MUST reject the write
- **AND** the frontend MUST present a reload path instead of overwriting the newer content

#### Scenario: Unmerged index changed externally
- **WHEN** the user applies a side action, AI candidate, or mark-resolved action after the unmerged index signature changed
- **THEN** the backend MUST reject the action as stale
- **AND** the frontend MUST reload conflict detail before allowing the action to continue

### Requirement: Large conflict files remain responsive
The system SHALL classify conflict files by explicit line and byte thresholds and keep large conflict rendering bounded.

#### Scenario: Normal text file opens
- **WHEN** a conflict text file has at most 5,000 lines and at most 1 MB per rendered content version
- **THEN** the system MAY load and render full content directly

#### Scenario: Large text file opens
- **WHEN** a conflict text file has more than 5,000 lines or more than 1 MB per rendered content version
- **THEN** the read-only top panes MUST render through virtualized line panes
- **AND** the user MUST still be able to navigate to conflict regions

#### Scenario: Very large text file opens
- **WHEN** a conflict text file has more than 50,000 lines or more than 10 MB per rendered content version
- **THEN** the read-only panes MUST use range-loaded virtualization
- **AND** file-wide AI actions MUST be disabled or require an explicitly bounded request
- **AND** conflict-region AI actions MAY remain available when the conflict window can be safely loaded

### Requirement: Non-standard conflict kinds have explicit fallback behavior
The system SHALL handle conflict kinds that cannot be represented as a simple two-sided text merge.

#### Scenario: Modify-delete conflict opens
- **WHEN** one side deletes a file and the other side modifies it
- **THEN** the conflict surface MUST identify the delete side
- **AND** the user MUST be able to choose an available keep/delete resolution where Git supports it

#### Scenario: Add-add conflict opens
- **WHEN** both sides independently add the same path
- **THEN** the conflict surface MUST render both available text sides when supported
- **AND** result editing MUST start from the current worktree result content

#### Scenario: Binary conflict opens
- **WHEN** a conflicted path is binary
- **THEN** the surface MUST avoid text editing
- **AND** the surface MUST offer supported side choice or external-editor guidance instead of rendering corrupt text
