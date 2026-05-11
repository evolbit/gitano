## MODIFIED Requirements

### Requirement: Durable layout and navigation preferences persist
The system SHALL persist stable layout and navigation preferences for the main workspace.

#### Scenario: User changes workspace layout
- **WHEN** the user resizes workspace panes or changes the active left-pane section
- **THEN** the system MUST persist those layout choices for the active repository

#### Scenario: User changes explorer and branch structure state
- **WHEN** the user changes branch tree expansion, main changes tree expansion, or current/commit flat-tree view mode
- **THEN** the system MUST persist those preferences for the active repository

#### Scenario: Repository workspace state is restored
- **WHEN** the user reopens a repository with persisted workspace state
- **THEN** the system MUST restore the last active left-pane section for that repository
- **THEN** the system MUST NOT require legacy accordion open state to restore the left-pane navigation
