## MODIFIED Requirements

### Requirement: Commit changes pane uses the shared changes explorer
The system SHALL render the commit changes file list using the shared changes explorer model rather than a flat-only legacy list.

#### Scenario: User reopens a repository after changing commit changes view mode
- **WHEN** the user previously changed the commit changes pane between `Flat View` and `Tree View`
- **THEN** the system MUST restore that commit changes view mode for the same repository
