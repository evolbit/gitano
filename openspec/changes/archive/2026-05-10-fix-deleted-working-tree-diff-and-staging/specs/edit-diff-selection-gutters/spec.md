## MODIFIED Requirements

### Requirement: Editable diff uses hierarchical staging selection
The system SHALL present editable diff staging controls as a three-level hierarchy across file, block, and line selection.

#### Scenario: Editable diff is rendered
- **WHEN** the user views an editable diff
- **THEN** the left file list MUST expose a file-level selection checkbox
- **THEN** the diff view MUST expose a block-level selection gutter in the far-left column
- **THEN** the diff view MUST expose a line-level selection gutter in the next column
- **THEN** line numbers and code content MUST render after those selection gutters

#### Scenario: Deleted file is rendered in editable mode
- **WHEN** the user views an editable diff for a deleted working-tree file
- **THEN** the file-level selection checkbox MUST remain available
- **THEN** block-level selection controls MUST NOT be shown
- **THEN** line-level selection controls MUST NOT be shown

### Requirement: Existing staging behavior remains the source of truth
The system SHALL preserve the existing staging semantics while exposing the hierarchical selection UI.

#### Scenario: User toggles file, block, or line selection
- **WHEN** the user interacts with the file, block, or line staging controls
- **THEN** the existing staged-line selection model MUST continue to drive the resulting selection state
- **THEN** this change MUST NOT require a new backend staging model

#### Scenario: User stages a deleted working-tree file
- **WHEN** the user stages or unstages a deleted working-tree file
- **THEN** the file checkbox MUST reflect the file-level staged state
- **THEN** the deleted file MUST NOT require block or line selection state to appear checked
