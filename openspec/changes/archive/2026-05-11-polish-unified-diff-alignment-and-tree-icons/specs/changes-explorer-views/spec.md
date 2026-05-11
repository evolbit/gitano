## MODIFIED Requirements

### Requirement: View switching is available from a context menu
The system SHALL expose `Flat View` and `Tree View` switching from visible toggle controls and from a context menu in both changes explorer surfaces.

#### Scenario: User changes view mode from the explorer header
- **WHEN** the user clicks the visible flat/tree toggle controls in the current changes pane or commit changes pane
- **THEN** the system MUST switch the active explorer between `Flat View` and `Tree View`
- **THEN** the selected mode MUST update the existing persisted mode state for that surface

#### Scenario: User reopens a repository after changing explorer modes
- **WHEN** the user previously changed the working changes or commit changes explorer mode for a repository
- **THEN** the system MUST restore those view modes independently for that repository

#### Scenario: User reopens a repository after changing tree expansion
- **WHEN** the user previously expanded or collapsed durable tree groups in the main workspace explorer for a repository
- **THEN** the system MUST restore that durable expansion state for the same repository
