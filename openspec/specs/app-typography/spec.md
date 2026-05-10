# app-typography Specification

## Purpose
TBD - created by archiving change use-ibm-plex-fonts. Update Purpose after archive.
## Requirements
### Requirement: App UI uses IBM Plex Sans by default
The system SHALL use `IBM Plex Sans` as the default font family for the application UI.

#### Scenario: User views general app UI
- **WHEN** the user views standard non-code UI surfaces in the app
- **THEN** those surfaces MUST render with `IBM Plex Sans` as the default font family

#### Scenario: Typography is available offline in the desktop app
- **WHEN** the desktop app is launched without external network access
- **THEN** the app typography MUST still resolve to the intended IBM Plex font families

### Requirement: Hunk and code surfaces use IBM Plex Mono
The system SHALL use `IBM Plex Mono` for code-oriented hunk and diff content.

#### Scenario: User views diff hunks
- **WHEN** a diff viewer or hunk surface renders code content
- **THEN** the code content MUST render with `IBM Plex Mono`
- **THEN** the code content MUST use an explicit diff font-size token so hunk sizing can remain independent from the general app UI font size

#### Scenario: User views mixed UI and code in the same diff experience
- **WHEN** the surrounding modal or app chrome renders alongside diff code
- **THEN** the surrounding UI MUST continue using the app sans font
- **THEN** the code/hunk rows MUST use the mono code font

