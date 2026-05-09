## ADDED Requirements

### Requirement: Editable diff uses hierarchical staging selection
The system SHALL present editable diff staging controls as a three-level hierarchy across file, block, and line selection.

#### Scenario: Editable diff is rendered
- **WHEN** the user views an editable diff
- **THEN** the left file list MUST expose a file-level selection checkbox
- **THEN** the diff view MUST expose a block-level selection gutter in the far-left column
- **THEN** the diff view MUST expose a line-level selection gutter in the next column
- **THEN** line numbers and code content MUST render after those selection gutters

### Requirement: Block selection targets contiguous changed blocks inside a hunk
The system SHALL allow users to select contiguous changed blocks independently within a hunk.

#### Scenario: Hunk contains multiple changed blocks
- **WHEN** a diff hunk contains multiple contiguous groups of stageable changed lines
- **THEN** each group MUST have its own block-level selection control
- **THEN** selecting one block MUST NOT require selecting the entire hunk
- **THEN** the UI MUST NOT treat the whole hunk as the only block-selection unit

### Requirement: File-level checkbox reflects partial selection state
The system SHALL show file-level checked, unchecked, and indeterminate states in the left file list.

#### Scenario: File is partially selected
- **WHEN** some but not all selectable changes in a file are selected
- **THEN** the file-level checkbox in the left panel MUST render an indeterminate state

#### Scenario: File is fully selected or fully deselected
- **WHEN** all selectable changes in a file are selected or none are selected
- **THEN** the file-level checkbox MUST render the corresponding checked or unchecked state

### Requirement: Existing staging behavior remains the source of truth
The system SHALL preserve the existing staging semantics while exposing the hierarchical selection UI.

#### Scenario: User toggles file, block, or line selection
- **WHEN** the user interacts with the file, block, or line staging controls
- **THEN** the existing staged-line selection model MUST continue to drive the resulting selection state
- **THEN** this change MUST NOT require a new backend staging model
