## ADDED Requirements

### Requirement: Branch AI review requires premium AI entitlement
The system SHALL require a valid premium AI entitlement before branch AI review can generate review findings or draft feedback.

#### Scenario: Entitled user runs branch AI review
- **WHEN** the user has a valid license that entitles premium AI features
- **AND** the user runs branch AI review
- **THEN** Gitano MUST allow the review to proceed according to existing branch AI review requirements

#### Scenario: Free user runs branch AI review
- **WHEN** the user does not have a valid premium AI entitlement
- **AND** the user runs branch AI review
- **THEN** the backend MUST reject the review before building branch review AI context
- **AND** the frontend MUST show that branch AI review requires a premium license
- **AND** no AI review findings or draft review comments MUST be created

#### Scenario: Entitlement changes while branch comparison is open
- **WHEN** the branch comparison modal is open
- **AND** premium AI entitlement becomes invalid
- **THEN** branch AI review controls MUST move to a locked state
- **AND** any new branch AI review request MUST be blocked before repository context is prepared
