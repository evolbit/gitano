## ADDED Requirements

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
