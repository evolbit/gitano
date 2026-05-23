## 1. Engine Resolution

- [x] 1.1 Add commit UI helper logic that resolves the effective action engine from action-specific preferences, global preferences, and legacy action model ids.
- [x] 1.2 Skip local model readiness checks when the effective commit-message engine is an external agent.
- [x] 1.3 Preserve local model readiness and setup behavior for local commit-message engines.

## 2. Commit Message Flow

- [x] 2.1 Ensure the commit-message AI button runs `commitMessage` through the existing backend action command for both local and external engines.
- [x] 2.2 Keep returned structured commit-message results filling the commit message textarea for both engine types.
- [x] 2.3 Keep setup/authentication and execution errors visible through the existing notice/setup paths.

## 3. Verification

- [x] 3.1 Add or update frontend tests for global external-agent commit-message generation.
- [x] 3.2 Add or update frontend tests for action-specific external-agent commit-message generation while the global engine is local.
- [x] 3.3 Run focused tests for the commit bar and shared local AI API.
