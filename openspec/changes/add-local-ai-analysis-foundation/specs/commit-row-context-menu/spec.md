## ADDED Requirements

### Requirement: Commit context menu supports local AI commit analysis
The system SHALL expose premium local AI commit analysis from commit row context menus.

#### Scenario: User opens context menu for a commit
- **WHEN** the user opens the context menu for a commit row
- **THEN** the menu MUST include a local AI analysis action for that commit

#### Scenario: User selects local AI commit analysis
- **WHEN** the user activates the local AI analysis action for a commit
- **THEN** the system MUST run commit analysis for the targeted commit SHA
- **AND** the system MUST show progress while local analysis is running

#### Scenario: Commit analysis succeeds
- **WHEN** local AI commit analysis completes
- **THEN** the system MUST show the structured summary and findings for the targeted commit
- **AND** the result MUST identify whether it came from cache or a fresh local run

#### Scenario: Local AI setup is required
- **WHEN** the selected model is not ready for commit analysis
- **THEN** the system MUST route the user through local AI setup before running analysis
