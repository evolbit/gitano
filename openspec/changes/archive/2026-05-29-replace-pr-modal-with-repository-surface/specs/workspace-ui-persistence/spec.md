## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Transient UI state does not persist
The system SHALL avoid restoring temporary interaction state that should not survive an app restart.

#### Scenario: User has temporary interaction state
- **WHEN** the app is reopened after searches, menus, temporary modal state, temporary pull request review state, pull request composer drafts, submission errors, loading states, or popovers were active
- **THEN** the system MUST NOT restore those transient states as persisted workspace state

#### Scenario: User toggles surfaces during one app session
- **WHEN** the user switches between the normal workspace and pull request surfaces during one app session
- **THEN** the system MUST restore in-session scroll and pull request review UI state needed to make the toggle feel continuous
- **AND** the system MUST NOT require that in-session restoration state to survive an app restart
