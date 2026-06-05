## Purpose

Define the diff viewer display modes and the guarantees when switching between them.

## Requirements

### Requirement: Diff viewer supports unified and split display modes
The system SHALL allow users to switch the shared diff viewer between `Unified` and `Split` display modes.

#### Scenario: User views a diff in unified mode
- **WHEN** the diff viewer is set to `Unified`
- **THEN** the system MUST render the current single-stream diff layout
- **THEN** old and new line numbers MUST remain in the same row stream as the code content
- **THEN** unified rows MUST top-align line numbers and code content using the same vertical rhythm as split rows

#### Scenario: User views a diff in split mode
- **WHEN** the diff viewer is set to `Split`
- **THEN** the system MUST render old content on the left and new content on the right
- **THEN** the system MUST pair the visual rows from the same underlying hunk data instead of requiring a separate backend diff format

### Requirement: Diff display mode switching preserves diff context
The system SHALL preserve the current diff inspection context while switching between unified and split modes.

#### Scenario: User changes display mode while inspecting a file
- **WHEN** the user changes the diff display mode for the active file
- **THEN** the same file MUST remain open
- **THEN** the same diff hunk data MUST remain active
- **THEN** the system MUST NOT clear the current selection state solely because the presentation mode changed

### Requirement: Diff code rows wrap within gutters
The system SHALL wrap long diff source content within the visible diff pane while keeping line-number and staging gutters fixed outside the wrapped content area.

#### Scenario: Long line appears in unified mode
- **WHEN** a unified diff row contains content wider than the visible diff pane
- **THEN** the source content MUST wrap within the available code column
- **THEN** old and new line-number gutters MUST remain fixed before the wrapped content
- **THEN** wrapped continuation text MUST NOT occupy the line-number or staging gutter columns

#### Scenario: Read-only unified diff wraps without staging gutters
- **WHEN** a unified diff row is rendered in a surface that does not expose staging controls
- **THEN** the row MUST NOT reserve staging gutter columns before the line-number gutters
- **THEN** wrapped source content MUST align after only the old and new line-number gutters

#### Scenario: Long line appears in split mode
- **WHEN** a split diff cell contains content wider than its visible side
- **THEN** the source content MUST wrap within that side's available code column
- **THEN** the center staging gutters and old/new line-number gutters MUST remain fixed outside the wrapped content
- **THEN** wrapped continuation text MUST NOT occupy the center gutter columns

#### Scenario: Long token appears in diff content
- **WHEN** diff content contains a token with no natural whitespace break before the pane edge
- **THEN** the token MUST break inside the visible code column instead of forcing horizontal overflow

### Requirement: Diff rows highlight inline changed text
The system SHALL emphasize changed text ranges inside comparable deleted and added diff lines while preserving existing row-level add/delete coloring.

#### Scenario: Comparable unified lines are rendered
- **WHEN** a unified diff hunk contains a deleted line and an added line that can be paired within the same changed block
- **THEN** the deleted line MUST show darker red emphasis over the text range that differs from the added line
- **AND** the added line MUST show darker green emphasis over the text range that differs from the deleted line
- **AND** the line-number gutters and source wrapping behavior MUST remain unchanged

#### Scenario: Comparable split lines are rendered
- **WHEN** a split diff hunk pairs a deleted line with an added line in the same visual row
- **THEN** the old-side cell MUST show darker red emphasis over the changed text range
- **AND** the new-side cell MUST show darker green emphasis over the changed text range
- **AND** staging gutters and review-line anchors MUST remain tied to the same logical diff lines

#### Scenario: Changed line has no comparable counterpart
- **WHEN** an added or deleted diff line has no paired counterpart in its changed block
- **THEN** the line MUST keep the existing whole-row add/delete tone
- **AND** the system MUST NOT add inline changed-text emphasis to that unmatched line
