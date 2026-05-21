## RENAMED Requirements
- FROM: `### Requirement: Diff code rows do not soft-wrap`
- TO: `### Requirement: Diff code rows wrap within gutters`

## MODIFIED Requirements

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
