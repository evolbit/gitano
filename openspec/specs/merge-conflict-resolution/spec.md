## Purpose

Define how Gitano exposes unresolved merge conflicts, renders conflict resolution surfaces, applies conflict choices safely, and supports scoped AI assistance for merge conflicts.

## Requirements

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
- **AND** each side-pane conflict highlight and action widget MUST be positioned from the matching side content for that same conflict id, not from result/worktree marker line numbers

#### Scenario: Result projection needs visual alignment rows
- **WHEN** unresolved result content has fewer visible lines than either side's conflict content
- **THEN** the result panel MUST use display-only empty alignment rows to preserve visual correspondence
- **AND** those rows MUST NOT be written to the worktree result file

#### Scenario: Conflict surface opens
- **WHEN** conflict detail is ready
- **THEN** the surface MUST scroll to the selected or first unresolved conflict region
- **AND** the user MUST be able to inspect full file context without losing the active conflict focus

#### Scenario: Conflict surface is constrained by the workspace
- **WHEN** the conflict resolution surface is rendered inside the repository right workspace
- **THEN** the surface content MUST fit within the available workspace bounds
- **AND** parent merge-surface containers MUST NOT create horizontal scrolling that can hide either side pane under adjacent workspace panels
- **AND** editor panes and control strips MAY expose their own bounded scrolling when their contents exceed available space

#### Scenario: Top panes are read-only
- **WHEN** the user interacts with the `Incoming` or `Current` panes
- **THEN** the panes MUST NOT allow direct editing
- **AND** side acceptance actions MUST update the `Result` content rather than modifying side content

### Requirement: Merge editor preserves side identity and visual alignment
The system SHALL make merge-editor side identity and conflict comparison visually clear without obscuring source content or writing display-only alignment rows to repository files.

#### Scenario: Merge editor renders side and result identity colors
- **WHEN** a supported text conflict renders `Incoming`, `Current`, and `Result` panes
- **THEN** each pane MUST use a consistent side-specific visual identity in its header and conflict-region UI
- **AND** `Incoming`, `Current`, and `Result` identities MUST be visually distinguishable from each other
- **AND** conflict-region coloring MUST preserve source-code readability in the configured Monaco theme

#### Scenario: Side-pane action rows do not cover code
- **WHEN** an unresolved conflict region exposes side-pane actions such as `Accept Incoming`, `Accept Current`, `Accept Combination`, or `Ignore`
- **THEN** those actions MUST render in reserved display-only vertical space associated with the conflict region
- **AND** the reserved action space MUST NOT show a source line number
- **AND** the reserved action space MUST NOT cover or hide any source text line

#### Scenario: Side panes align matching conflict regions while scrolling
- **WHEN** the user scrolls either read-only side pane for a supported text conflict
- **THEN** the opposite read-only side pane MUST keep matching conflict regions visually aligned where matching side-region data is available
- **AND** alignment MUST account for conflict regions where one side has extra, removed, or expanded lines relative to the other side
- **AND** the alignment behavior MUST NOT create feedback-loop scrolling or repeated recentering of the active region

#### Scenario: Visual spacing remains display-only
- **WHEN** the merge editor adds action spacing or side-alignment spacing
- **THEN** the spacing MUST be display-only and MUST NOT alter source text, result content, line numbers, saved file content, or conflict signatures

#### Scenario: Very large side panes preserve non-overlapping actions
- **WHEN** a very large conflict uses range-loaded read-only side panes
- **THEN** side identity colors and conflict actions MUST remain visible without obscuring loaded source lines
- **AND** exact side-region alignment MAY be limited to ranges where required line and region metadata is available without loading the full file

### Requirement: Conflict editors use lazy-loaded Monaco for supported text files
The system SHALL use lazy-loaded Monaco editors only inside the conflict resolution surface for supported text conflict panes and result editing.

#### Scenario: Supported conflict editors open
- **WHEN** a supported text conflict file is rendered in the conflict resolution surface
- **THEN** the app MUST lazy-load `@monaco-editor/react`
- **AND** Monaco MUST be mounted only inside conflict resolution panes and the result editor
- **AND** editor languages MUST be inferred from the file path when possible

#### Scenario: Conflict Monaco themes load
- **WHEN** Monaco is loaded for the conflict resolution surface
- **THEN** the app MUST register editor themes through the shared Monaco theme registry
- **AND** read-only side panes and the result editor MUST use the named Ayu Dark Monaco theme by default
- **AND** adding another conflict editor theme MUST NOT require pane-specific `defineTheme` calls

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

#### Scenario: User reviews non-selected conflict regions
- **WHEN** a side pane renders multiple conflict regions
- **THEN** every unresolved conflict region MUST expose its side, combination, and ignore actions without requiring arrow navigation first
- **AND** conflict region highlighting MUST use a continuous block treatment without per-line borders inside the highlighted region

#### Scenario: User accepts an entire side file
- **WHEN** the user can replace the result with an entire side
- **THEN** the `Incoming` pane header MUST expose `Accept Incoming File`
- **AND** the `Current` pane header MUST expose `Accept Current File`
- **AND** the `Result` panel MUST keep result-specific actions such as save, reset, and mark resolved separate from side-file acceptance actions
- **AND** for supported text conflicts, accepting an entire side MUST apply that side to every conflict region as individual accepted-region results
- **AND** each accepted region in the `Result` panel MUST show the chosen side label and a `Remove <side>` action
- **AND** removing one accepted region after a side-file acceptance MUST restore only that region to the original loaded projection while leaving other accepted regions unchanged
- **AND** the opposite side's per-region side and combination actions MUST remain available so the user can replace an accepted region with the other side or a combination

#### Scenario: User changes an accepted conflict region
- **WHEN** the user has accepted one side or a combination for the active conflict region
- **THEN** the result panel MUST show an inline accepted-region label with a `Remove <accepted choice>` action for that region
- **AND** removing the accepted choice MUST restore that region to the original loaded projection, not to an intermediate accepted side
- **AND** the top pane for the side that was not chosen MUST keep its side and combination actions available
- **AND** choosing the other side or a combination MUST replace the accepted region content and keep the inline remove action available for the new accepted choice

#### Scenario: Side acceptance is unsupported
- **WHEN** the conflict kind does not support direct side acceptance
- **THEN** the UI MUST disable or omit the unsupported side action
- **AND** the UI MUST still provide manual result editing or external-editor guidance when available

#### Scenario: User resets the conflict result
- **WHEN** the user chooses to reset the open conflict result
- **THEN** the result panel MUST return to the initially loaded conflict projection
- **AND** accepted-region state and AI-applied region state MUST be cleared for that file
- **AND** unresolved projected regions MUST become pending again
- **AND** the reset MUST preserve the latest conflict signatures for the next save or mark-resolved action

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

### Requirement: Merge editor applies file-level AI fixes directly
The system SHALL expose AI Fix as one file-level merge action that applies validated AI output to the result editor and explains the per-region choices.

#### Scenario: User runs AI Fix for a supported text conflict
- **WHEN** a supported text conflict file is open and file-wide AI is available
- **THEN** the AI Fix row MUST expose one primary `Resolve with AI` file-level action instead of separate region and file scope buttons
- **AND** activating the action MUST run the configured AI engine for the selected conflicted file
- **AND** the returned file candidate MUST be applied to the result editor after stale-state validation without requiring a separate Apply button

#### Scenario: AI Fix applies per-region decisions
- **WHEN** a file-scoped AI candidate includes per-region decisions
- **THEN** the result panel MUST mark those conflict regions as no longer pending
- **AND** the top panes MUST reflect the selected side for regions where the AI chose `incoming` or `current`
- **AND** combination or custom decisions MUST remain visible as accepted AI choices without claiming one side was exclusively selected

#### Scenario: AI Fix completion explains choices in the result panel
- **WHEN** the AI Fix action completes and applies a candidate
- **THEN** the result panel's bottom status message MUST show only the concise completion summary
- **AND** the result panel MUST expose a `View details` control when full detail or decision metadata is available
- **AND** activating `View details` MUST open a modal instead of expanding details inline in the result panel
- **AND** the details modal MUST show which region chose which side or choice and why when that metadata is available
- **AND** the details modal MUST render each conflict decision as a separate row in neutral app styling
- **AND** the details modal MUST align conflict ids with the first line of their explanations
- **AND** the details modal MUST capitalize the first letter of each explanation
- **AND** the details modal MUST allow scrolling when the details exceed the available modal height
- **AND** the result panel's AI status message MUST expose a dismiss control that hides the summary row without changing the result content

#### Scenario: AI Fix failure appears in the result panel
- **WHEN** the AI Fix action fails after being started from the merge editor
- **THEN** the result panel's bottom status message MUST show the failure
- **AND** the AI Fix row MUST NOT render a separate failure message below the button row

#### Scenario: AI Fix remains explicit about saving
- **WHEN** AI Fix applies a candidate to the result editor
- **THEN** the result MUST become dirty like manual edits or side accept actions
- **AND** the user MUST still save or mark resolved through the existing result-panel actions

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
