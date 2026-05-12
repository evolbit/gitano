# workspace-ui-persistence Specification

## Purpose
TBD - created by archiving change persist-window-and-workspace-ui-state. Update Purpose after archive.
## Requirements
### Requirement: Window bounds persist across app restarts
The system SHALL restore the last durable window size and position when the app is reopened.

#### Scenario: User resizes the window
- **WHEN** the user resizes the application window
- **THEN** the system MUST persist the resulting window size

#### Scenario: App is reopened after window resize
- **WHEN** the app launches after the user previously resized or moved the window
- **THEN** the system MUST restore the last persisted window bounds
- **THEN** the restored size MUST still respect the configured minimum window constraints

### Requirement: Per-repository workspace UI state persists
The system SHALL persist durable workspace UI preferences per repository, keyed by repository path.

#### Scenario: User reopens a repository
- **WHEN** the user closes and later reopens a repository
- **THEN** the system MUST restore that repository's persisted workspace UI state

#### Scenario: User switches between repositories
- **WHEN** the user works in multiple repositories with different workspace preferences
- **THEN** the system MUST preserve each repository's own persisted state independently

### Requirement: Durable layout and navigation preferences persist
The system SHALL persist stable layout and navigation preferences for the main workspace.

#### Scenario: User changes workspace layout
- **WHEN** the user resizes workspace panes, changes the active left-pane section, opens an inline working-tree diff, or opens an inline commit-file diff
- **THEN** the system MUST persist those layout and workspace-mode choices for the active repository

#### Scenario: User changes explorer and branch structure state
- **WHEN** the user changes branch tree expansion, main changes tree expansion, or current/commit flat-tree view mode
- **THEN** the system MUST persist those preferences for the active repository

#### Scenario: Repository workspace state is restored
- **WHEN** the user reopens a repository with persisted workspace state
- **THEN** the system MUST restore the last active left-pane section for that repository
- **THEN** the system MUST restore any repo-scoped inline diff workspace mode and selected diff target needed to reconstruct the pane layout
- **THEN** the system MUST NOT require legacy accordion open state to restore the left-pane navigation

### Requirement: Transient UI state does not persist
The system SHALL avoid restoring temporary interaction state that should not survive an app restart.

#### Scenario: User has temporary interaction state
- **WHEN** the app is reopened after searches, menus, temporary modal state, or loading states were active
- **THEN** the system MUST NOT restore those transient states as persisted workspace state

