## ADDED Requirements

### Requirement: Component folders
The system SHALL organize each component into its own folder under `src/components`, with the primary component implementation stored inside that folder.

#### Scenario: Component is moved into a folder
- **WHEN** a component is refactored as part of this change
- **THEN** its source file MUST live in a dedicated folder named for the component or feature area

### Requirement: Local types and hooks separation
The system SHALL place component-specific types and hook orchestration into separate local files when doing so improves readability and keeps the render file focused.

#### Scenario: Component has local type definitions
- **WHEN** a component defines non-trivial props or internal data shapes
- **THEN** those types MUST be movable into a local `types.ts` file without changing behavior

#### Scenario: Component has local hook orchestration
- **WHEN** a component contains meaningful reusable hook logic such as loading, persistence, timing, or layout observation
- **THEN** that logic MUST be movable into a local `hooks.ts` file without changing behavior

### Requirement: Shared pure utilities
The system SHALL keep reusable pure helper logic in shared utility modules so multiple components can import the same implementation.

#### Scenario: Helper is used by multiple components
- **WHEN** a pure helper is needed by more than one component
- **THEN** the helper MUST live in a shared utility module instead of being duplicated inside component files

### Requirement: Behavior preservation
The system SHALL preserve the existing runtime behavior, interaction flow, and visual output while the component files are reorganized.

#### Scenario: Refactor is complete
- **WHEN** the component folders and utility modules have been reorganized
- **THEN** the application MUST behave the same as before the refactor from the user’s perspective
