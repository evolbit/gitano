## ADDED Requirements

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
