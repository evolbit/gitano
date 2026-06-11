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

### Requirement: Repository active surface state is tracked per repository
The system SHALL track the active repository surface independently for each repository path.

#### Scenario: User switches one repository to pull requests
- **WHEN** the user switches repository A from the normal workspace surface to the pull requests surface
- **THEN** the system MUST update only repository A's active surface state
- **AND** the system MUST NOT change repository B's active surface state

#### Scenario: User switches between repository tabs
- **WHEN** different repository tabs have different active surface states
- **AND** the user switches the active repository tab
- **THEN** the system MUST render the active surface stored for the newly active repository
- **AND** the top toolbar surface toggle MUST match that repository's active surface

#### Scenario: Repository has no stored surface state
- **WHEN** a repository has no stored active surface state
- **THEN** the system MUST default that repository to the normal workspace surface

### Requirement: Durable layout and navigation preferences persist
The system SHALL persist stable layout and navigation preferences for the main workspace.

#### Scenario: User changes workspace layout
- **WHEN** the user resizes workspace panes, changes the active left-pane section, opens an inline working-tree diff, or opens an inline commit-file diff
- **THEN** the system MUST persist those layout and workspace-mode choices for the active repository

#### Scenario: User changes explorer and branch structure state
- **WHEN** the user changes branch tree expansion, main changes tree expansion, or current/commit flat-tree view mode
- **THEN** the system MUST persist those preferences for the active repository

#### Scenario: User changes branch location filters
- **WHEN** the user changes the local/remote filter selection in the branches panel
- **THEN** the system MUST persist the branch filter selection for the active repository
- **THEN** the persisted branch filter selection MUST remain independent from the tags panel filter selection

#### Scenario: User changes tag location filters
- **WHEN** the user changes the local/remote filter selection in the tags panel
- **THEN** the system MUST persist the tag filter selection for the active repository
- **THEN** the persisted tag filter selection MUST remain independent from the branches panel filter selection

#### Scenario: Repository workspace state is restored
- **WHEN** the user reopens a repository with persisted workspace state
- **THEN** the system MUST restore the last active left-pane section for that repository
- **THEN** the system MUST restore branch and tag local/remote filter selections for that repository
- **THEN** the system MUST restore any repo-scoped inline diff workspace mode and selected diff target needed to reconstruct the pane layout
- **THEN** the system MUST NOT require legacy accordion open state to restore the left-pane navigation

#### Scenario: Repository has no persisted location filter state
- **WHEN** a repository workspace state does not include branch or tag location filter selections
- **THEN** the system MUST default the missing panel filter to both local and remote active

### Requirement: Workspace and pull request surfaces restore after toggling
The system SHALL preserve the user-visible UI state needed to restore both the normal workspace and pull request surfaces after the user toggles between them.

#### Scenario: User returns to the normal workspace
- **WHEN** the user switches from the normal workspace surface to the pull requests surface
- **AND** the user later switches back to the normal workspace surface in the same repository
- **THEN** the system MUST restore the normal workspace's selected panels, selected inline diff target, pane sizes, explorer mode, tree expansion, and relevant scroll positions

#### Scenario: User returns to the pull request list
- **WHEN** the user switches from the pull requests surface to the normal workspace surface
- **AND** the pull requests surface was previously showing the pull request list
- **AND** the user later switches back to the pull requests surface in the same repository
- **THEN** the system MUST restore the pull request list state needed for the current app session

#### Scenario: User returns to pull request review
- **WHEN** the user switches from the pull requests surface to the normal workspace surface
- **AND** the pull requests surface was previously reviewing a pull request
- **AND** the user later switches back to the pull requests surface in the same repository
- **THEN** the system MUST restore review mode for that pull request
- **AND** the system MUST restore the review selected file, diff display mode, explorer mode, conversation visibility, and relevant scroll positions for that pull request

### Requirement: Pull request review state is scoped by repository and pull request
The system SHALL scope pull request review UI state by repository path and pull request number.

#### Scenario: User reviews multiple pull requests in one repository
- **WHEN** the user reviews pull request #12 and then pull request #18 in the same repository
- **THEN** the system MUST keep separate selected file, diff mode, conversation visibility, and scroll state for each pull request

#### Scenario: User reviews same pull request number in different repositories
- **WHEN** repository A and repository B each have a pull request #12
- **THEN** the system MUST keep each repository's pull request #12 UI state independent

### Requirement: Transient UI state does not persist
The system SHALL avoid restoring temporary interaction state that should not survive an app restart.

#### Scenario: User has temporary interaction state
- **WHEN** the app is reopened after searches, menus, temporary modal state, temporary pull request review state, pull request composer drafts, submission errors, loading states, or popovers were active
- **THEN** the system MUST NOT restore those transient states as persisted workspace state

#### Scenario: User toggles surfaces during one app session
- **WHEN** the user switches between the normal workspace and pull request surfaces during one app session
- **THEN** the system MUST restore in-session scroll and pull request review UI state needed to make the toggle feel continuous
- **AND** the system MUST NOT require that in-session restoration state to survive an app restart
