## ADDED Requirements

### Requirement: Git AI actions apply per-action prompt overrides
The system SHALL apply persisted per-action prompt overrides when building Git AI prompts while preserving Gitano-owned execution constraints.

#### Scenario: Local model action has a prompt override
- **WHEN** a local model Git AI action starts and a prompt override exists for that action
- **THEN** the backend MUST include the override as the action-specific instruction
- **AND** the backend MUST still include the required Git context and structured JSON output requirements

#### Scenario: External agent action has a prompt override
- **WHEN** an external agent Git AI action starts and a prompt override exists for that action
- **THEN** the backend MUST include the override as the action-specific instruction for the selected external agent
- **AND** the backend MUST still include read-only repository inspection constraints and the expected output shape

#### Scenario: Prompt override is not configured
- **WHEN** a Git AI action starts and no prompt override exists for that action
- **THEN** the backend MUST use Gitano's app-provided default prompt instruction for that action

#### Scenario: Prompt override changes
- **WHEN** a user changes or clears a prompt override for an AI action
- **THEN** cached AI results generated with the previous effective prompt MUST NOT be treated as fresh for the new effective prompt

#### Scenario: Prompt override attempts to remove app constraints
- **WHEN** a prompt override asks for output that conflicts with Gitano's structured result requirements or read-only execution constraints
- **THEN** Gitano's app-owned output, context, and safety constraints MUST remain part of the final prompt
