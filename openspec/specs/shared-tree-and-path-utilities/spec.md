# shared-tree-and-path-utilities Specification

## Purpose
TBD - created by archiving change extract-tree-and-path-utilities. Update Purpose after archive.
## Requirements
### Requirement: Shared path helpers
The system SHALL provide reusable pure helpers for common slash-delimited path operations used by component renderers, including file name extraction, parent path extraction, and ancestor folder path enumeration.

#### Scenario: Extract a file name and parent path
- **WHEN** a component passes a path such as `src/components/ChangesExplorer.tsx` to the shared helpers
- **THEN** the helpers MUST return the same file name and parent path values that the current inline logic produces

#### Scenario: Enumerate ancestor folders
- **WHEN** a component requests ancestor folder paths for `src/components/ChangesExplorer.tsx`
- **THEN** the helpers MUST return the same ancestor chain currently used to expand tree views

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

### Requirement: No visible behavior change
The system SHALL preserve the current visible behavior of branch grouping, file tree rendering, and file path display while using the shared utilities.

#### Scenario: Existing explorers still render the same
- **WHEN** the branch list and current changes explorer render after the refactor
- **THEN** their visible hierarchy, sorting, and path display MUST remain unchanged
