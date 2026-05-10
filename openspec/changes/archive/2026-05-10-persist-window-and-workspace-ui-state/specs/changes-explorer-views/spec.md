## MODIFIED Requirements

### Requirement: View switching is available from a context menu
The system SHALL expose `Flat View` and `Tree View` switching from a context menu in both changes explorer surfaces.

#### Scenario: User reopens a repository after changing explorer modes
- **WHEN** the user previously changed the working changes or commit changes explorer mode for a repository
- **THEN** the system MUST restore those view modes independently for that repository

#### Scenario: User reopens a repository after changing tree expansion
- **WHEN** the user previously expanded or collapsed durable tree groups in the main workspace explorer for a repository
- **THEN** the system MUST restore that durable expansion state for the same repository
