# immediate-index-staging Specification

## Purpose
TBD - created by archiving change immediate-index-staging-for-working-changes. Update Purpose after archive.
## Requirements
### Requirement: Working-change selection stages immediately in the Git index
The system SHALL apply working-change stage operations to the Git index immediately when the user selects content in the editable working-changes UI.

#### Scenario: User selects tracked modified lines or blocks
- **WHEN** the user selects a stageable line or block in a tracked modified file
- **THEN** the system MUST immediately apply that staging change to the Git index
- **THEN** the UI MUST refresh to reflect the resulting staged state

#### Scenario: User checks an untracked file
- **WHEN** the user checks an untracked file in the working-changes explorer
- **THEN** the system MUST immediately stage that file in the Git index
- **THEN** the UI MUST refresh to reflect the resulting staged state

#### Scenario: User checks a deleted file
- **WHEN** the user checks a deleted working-tree file
- **THEN** the system MUST immediately stage the deletion in the Git index
- **THEN** the UI MUST refresh to reflect the resulting staged state

### Requirement: Working-change deselection unstages immediately in the Git index
The system SHALL apply working-change unstage operations to the Git index immediately when the user deselects previously staged content in the editable working-changes UI.

#### Scenario: User deselects tracked modified lines or blocks
- **WHEN** the user deselects a previously staged line or block in a tracked modified file
- **THEN** the system MUST immediately unstage that content from the Git index
- **THEN** the UI MUST refresh to reflect the resulting staged state

#### Scenario: User unchecks an untracked or deleted file
- **WHEN** the user unchecks a previously staged untracked file or deleted file
- **THEN** the system MUST immediately unstage that file-level change from the Git index
- **THEN** the UI MUST refresh to reflect the resulting staged state

### Requirement: Commit uses already-staged content
The system SHALL commit the content already staged in the Git index instead of applying deferred working-change staging selections only at commit time.

#### Scenario: User commits after staging selections
- **WHEN** the user commits after staging lines, blocks, or files through the working-changes UI
- **THEN** the commit flow MUST use the content already present in the Git index

#### Scenario: No staged changes exist
- **WHEN** the user attempts to commit with no staged content in the Git index
- **THEN** the system MUST prevent or reject the commit attempt with appropriate feedback

