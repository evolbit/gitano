## ADDED Requirements

### Requirement: Toolbar branch and tag context reacts to repository-change events
The system SHALL refresh branch/tag-dependent toolbar context from repository-change events.

#### Scenario: Branch refs change
- **WHEN** backend events indicate `branches` or `head` changes for the active repository
- **THEN** the toolbar branch context MUST refresh without requiring manual branch-menu reopening
- **THEN** push target context derived from active branch selection MUST stay consistent with refreshed refs

#### Scenario: Tag refs change
- **WHEN** backend events indicate `tags` changes for the active repository
- **THEN** toolbar data sources that expose or depend on tag metadata MUST refresh from the latest repository state

#### Scenario: Unrelated repository changes occur
- **WHEN** backend events are received without `branches`, `head`, or `tags` kinds
- **THEN** toolbar branch/tag refresh MUST NOT run solely because unrelated change kinds were emitted
