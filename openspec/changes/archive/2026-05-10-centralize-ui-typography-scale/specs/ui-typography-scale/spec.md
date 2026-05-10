## ADDED Requirements

### Requirement: App UI uses a centralized typography size scale
The system SHALL define and use a centralized typography size scale for the normal application UI.

#### Scenario: User views standard app UI
- **WHEN** the user views standard non-diff UI surfaces in the app
- **THEN** those surfaces MUST resolve their default text sizing from the shared UI typography scale

#### Scenario: UI scale can be adjusted centrally later
- **WHEN** developers need to adjust the default application UI size
- **THEN** the baseline size MUST be changeable from a clear centralized configuration point

### Requirement: Diff sizing remains independent from the UI scale
The system SHALL keep diff and hunk sizing independent from the centralized application UI scale.

#### Scenario: UI scale changes
- **WHEN** the centralized application UI scale is adjusted
- **THEN** diff and hunk code sizing MUST continue to resolve from the dedicated diff font-size token

#### Scenario: User views mixed UI and code surfaces
- **WHEN** normal UI and diff/hunk content appear in the same workflow
- **THEN** the normal UI MUST use the centralized UI scale
- **THEN** the diff/hunk content MUST continue using the separate diff font-size token
