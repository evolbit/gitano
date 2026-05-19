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

### Requirement: Diff code rows do not soft-wrap
The system SHALL render each diff source line as a single visual row by default so line-number gutters remain vertically compact.

#### Scenario: Long line appears in unified mode
- **WHEN** a unified diff row contains content wider than the visible diff pane
- **THEN** the code content MUST NOT soft-wrap onto additional visual lines
- **AND** the old/new line-number gutter MUST NOT develop extra vertical gaps caused by wrapped content

#### Scenario: Long line appears in split mode
- **WHEN** a split diff cell contains content wider than its visible side
- **THEN** the code content MUST NOT soft-wrap onto additional visual lines
- **AND** horizontal scrolling MUST remain available through the diff viewer container
