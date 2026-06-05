## MODIFIED Requirements

### Requirement: Changes explorer supports flat and tree presentations
The system SHALL provide a shared changes explorer that can render changed files in flat and tree views, including conflict grouping when unresolved conflicts are present.

#### Scenario: User views changed files in flat mode without conflicts
- **WHEN** the changes explorer is set to `Flat View`
- **AND** no unresolved conflicts are present
- **THEN** the explorer MUST render changed files as a flat list grouped into tracked and untracked sections
- **THEN** each file row MUST show the file name before its parent path
- **THEN** each file row MUST show insertion and deletion counts when available

#### Scenario: User views changed files in flat mode with conflicts
- **WHEN** the changes explorer is set to `Flat View`
- **AND** unresolved conflicts are present
- **THEN** the explorer MUST render conflicted files in a `Conflicts` section before tracked and untracked sections
- **AND** conflicted rows MUST remain selectable as file rows
- **AND** conflicted rows MUST NOT expose normal staging checkboxes or normal line-staging controls

#### Scenario: User views changed files in tree mode without conflicts
- **WHEN** the changes explorer is set to `Tree View`
- **AND** no unresolved conflicts are present
- **THEN** the explorer MUST render changed files as a filesystem tree grouped into tracked and untracked sections
- **THEN** folder rows MUST reflect the nested path structure of the changed files
- **THEN** file rows MUST remain selectable inside the rendered tree

#### Scenario: User views changed files in tree mode with conflicts
- **WHEN** the changes explorer is set to `Tree View`
- **AND** unresolved conflicts are present
- **THEN** the explorer MUST render conflicted files as a filesystem tree in a `Conflicts` section before tracked and untracked sections
- **AND** conflict folder rows MUST reflect the nested path structure of conflicted files
- **AND** conflict file rows MUST remain selectable inside the rendered tree
