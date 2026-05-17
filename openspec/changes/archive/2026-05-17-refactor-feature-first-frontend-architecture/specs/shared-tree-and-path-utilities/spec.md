## ADDED Requirements

### Requirement: Shared utility layer placement
The system SHALL expose reusable tree and path helpers from the shared utility layer.

#### Scenario: Path helper is migrated
- **WHEN** a slash-delimited path helper is moved during the feature-first refactor
- **THEN** it MUST live under `src/shared` and preserve the existing helper output for current call sites

#### Scenario: Tree helper is migrated
- **WHEN** a branch tree or changes explorer tree helper is moved during the feature-first refactor
- **THEN** it MUST live under `src/shared` and preserve the existing hierarchy, sorting, traversal, and compression behavior

### Requirement: Shared utility tests
The system SHALL cover shared tree and path helpers with focused tests.

#### Scenario: Path utility test coverage
- **WHEN** path helpers are migrated to the shared layer
- **THEN** tests MUST cover file name extraction, parent path extraction, and ancestor folder enumeration

#### Scenario: Tree utility test coverage
- **WHEN** tree helpers are migrated to the shared layer
- **THEN** tests MUST cover branch grouping priority order, file tree compression, and traversal helpers
