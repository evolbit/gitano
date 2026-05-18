## ADDED Requirements

### Requirement: Commit box supports local AI commit message generation
The system SHALL offer premium local AI commit message generation from the current staged change set in the current changes commit box.

#### Scenario: User has staged changes and local AI is ready
- **WHEN** the current changes commit box is visible
- **AND** the repository has staged changes
- **AND** local AI entitlement and the selected model are ready
- **THEN** the commit box MUST offer an action to generate a commit message locally

#### Scenario: User requests generated commit message
- **WHEN** the user triggers local AI commit message generation
- **THEN** the system MUST run the commit message action against the staged change snapshot
- **AND** the commit box MUST show a loading state while generation is running

#### Scenario: Commit message generation succeeds
- **WHEN** local AI returns a generated commit message
- **THEN** the commit message input MUST be filled with the generated message
- **AND** the user MUST still explicitly trigger commit or commit and push

#### Scenario: Staged changes are missing
- **WHEN** the repository has no staged changes
- **THEN** the local AI commit message action MUST be disabled or hidden

#### Scenario: Local AI setup is required
- **WHEN** the user triggers commit message generation and the selected model is not ready
- **THEN** the system MUST route the user through local AI setup before running generation
