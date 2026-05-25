## ADDED Requirements

### Requirement: AI review findings can become pull request draft comments
The system SHALL allow user-selected AI review findings in pull request review mode to become draft GitHub pull request review comments.

#### Scenario: User applies an AI finding in pull request review mode
- **WHEN** a pull request review mode AI finding has a valid changed-line anchor
- **AND** the user applies the finding
- **THEN** Gitano MUST create a bot-authored draft review comment at that pull request diff anchor
- **AND** the draft comment body MUST use the finding's suggested PR comment text when available

#### Scenario: User edits an applied AI finding
- **WHEN** an AI finding has been applied as a draft pull request review comment
- **THEN** the user MUST be able to edit the draft comment with the Markdown composer before submission

#### Scenario: User does not apply an AI finding
- **WHEN** an AI finding remains unapplied
- **THEN** Gitano MUST NOT submit that finding to GitHub
- **AND** Gitano MUST NOT include it in pull request review submission payloads

### Requirement: AI review remains non-mutating until explicit PR submission
The system SHALL preserve non-mutating AI review behavior until the user explicitly submits pull request feedback.

#### Scenario: User runs AI review in pull request review mode
- **WHEN** local AI branch review runs for a pull request
- **THEN** Gitano MUST NOT submit comments to GitHub as part of the AI review run
- **AND** Gitano MUST present findings as user-controlled feedback

#### Scenario: User submits selected draft comments
- **WHEN** the user explicitly submits pull request review feedback
- **THEN** only selected draft review comments MUST be sent to GitHub
- **AND** unapplied AI findings MUST remain local to the modal session

#### Scenario: User runs AI review outside pull request review mode
- **WHEN** local AI branch review runs in normal branch comparison mode
- **THEN** Gitano MUST preserve the existing local-only behavior
- **AND** Gitano MUST NOT show GitHub submission actions
