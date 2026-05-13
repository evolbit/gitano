## MODIFIED Requirements

### Requirement: Shared tree shaping helpers
The system SHALL provide reusable pure helpers for building and traversing slash-delimited trees used by branch and file explorers.

#### Scenario: Group branches into a tree
- **WHEN** the branch list passes slash-delimited branch names to the shared tree helpers
- **THEN** the helpers MUST produce the same grouped structure that the branch tree renderer expects
- **THEN** top-level and nested branch nodes MUST be ordered with explicit priority families first: `develop` aliases, then `main` aliases, then `stage` aliases
- **THEN** branch nodes outside priority families MUST be ordered alphabetically after the priority families

#### Scenario: Build compressed file trees
- **WHEN** the changes explorer passes file paths into the shared tree helpers
- **THEN** the helpers MUST produce the same compressed tree structure, including single-child folder compression, that the current explorer uses

#### Scenario: Traverse tree contents
- **WHEN** a component collects folder paths or file entries from a shared tree structure
- **THEN** the traversal helpers MUST return the same paths and file collections that the current inline traversal logic produces
