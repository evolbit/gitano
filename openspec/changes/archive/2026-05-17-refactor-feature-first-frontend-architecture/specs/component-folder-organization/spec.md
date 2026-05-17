## ADDED Requirements

### Requirement: Feature-owned component placement
The system SHALL place feature-owned React components under the owning feature instead of the generic top-level component bucket.

#### Scenario: Component belongs to one workflow
- **WHEN** a component is only used by one workflow such as branches, changes, commits, diffs, stashes, worktrees, tags, launchpad, or repository layout
- **THEN** the component MUST live under the owning `src/features/<feature>` subtree after migration

#### Scenario: Component has feature-local support files
- **WHEN** a feature-owned component needs local types, hooks, API calls, utilities, or tests
- **THEN** those files MUST be colocated inside the owning feature subtree

### Requirement: Shared UI component placement
The system SHALL place reusable generic UI primitives under the shared UI layer.

#### Scenario: Component is reused across features
- **WHEN** a component is generic and reused by multiple feature workflows
- **THEN** the component MUST live under `src/shared/ui` or another documented shared UI path

#### Scenario: Component is promoted to shared UI
- **WHEN** a feature-owned component becomes reusable by multiple features
- **THEN** feature-specific behavior MUST be removed or passed through typed props before the component is promoted to shared UI
