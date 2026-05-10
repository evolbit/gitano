## MODIFIED Requirements

### Requirement: Editable diff uses hierarchical staging selection
The system SHALL present editable diff staging controls as a three-level hierarchy across file, block, and line selection.

#### Scenario: Editable diff is rendered in unified mode
- **WHEN** the user views an editable diff in `Unified` mode
- **THEN** the left file list MUST expose a file-level selection checkbox
- **THEN** the diff view MUST expose a block-level selection gutter in the far-left column
- **THEN** the diff view MUST expose a line-level selection gutter in the next column
- **THEN** line numbers and code content MUST render after those selection gutters

#### Scenario: Editable diff is rendered in split mode
- **WHEN** the user views an editable diff in `Split` mode
- **THEN** the left file list MUST expose a file-level selection checkbox
- **THEN** the diff view MUST render old content on the left and new content on the right
- **THEN** the block-level and line-level selection gutters MUST render in the center seam between both sides
- **THEN** the split presentation MUST continue using the same logical changed lines for selection state

#### Scenario: Deleted file is rendered in editable mode
- **WHEN** the user views an editable diff for a deleted working-tree file
- **THEN** the file-level selection checkbox MUST remain available
- **THEN** block-level selection controls MUST NOT be shown
- **THEN** line-level selection controls MUST NOT be shown

### Requirement: Block selection targets contiguous changed blocks inside a hunk
The system SHALL allow users to select contiguous changed blocks independently within a hunk.

#### Scenario: Hunk contains multiple changed blocks
- **WHEN** a diff hunk contains multiple contiguous groups of stageable changed lines
- **THEN** each group MUST have its own block-level selection control
- **THEN** selecting one block MUST NOT require selecting the entire hunk
- **THEN** the UI MUST NOT treat the whole hunk as the only block-selection unit

#### Scenario: User selects a block in split mode
- **WHEN** the user toggles a block-level selection control while the diff viewer is in `Split` mode
- **THEN** the system MUST apply that selection to the full logical block
- **THEN** the selected state MUST appear across both the left and right rendered sides of that block when those sides exist
