## Context

The backend `ai_run_action` command already decides between local model execution and the external ACP agent path from stored analysis-engine preferences. Commit message generation reaches that command from `CurrentChangesCommitBar`, but the frontend first calls a local-model readiness guard that only reads legacy `actionModelIds`. When an external agent is the selected engine, that guard can block the action with a local-model error before the backend can route to the external agent.

## Goals / Non-Goals

**Goals:**
- Resolve the effective engine for commit-message actions from `actionEngines`, global `analysisEngine`, and legacy model preferences.
- Skip local model status checks when the effective engine is an external agent.
- Preserve current local-model setup behavior when a local model is selected.
- Cover both external-agent and local-model commit-message generation in frontend tests.

**Non-Goals:**
- Change the backend ACP execution path, prompt format, or result parser.
- Add a new commit-message progress modal for external agents.
- Change settings UI selection semantics.

## Decisions

- Use a small frontend helper to resolve the effective analysis engine for an action. This mirrors settings/backend preference semantics and keeps commit UI logic readable.
- Treat a missing or empty action-local model as inheriting the global engine only when the global engine is external. This matches the backend's external-agent preflight while preserving the existing local-model requirement for action-specific model selection.
- Continue delegating execution to `runLocalAiAction`. Despite the name, that command already routes selected external agents through the backend ACP path and returns the same structured `commitMessage` result shape.
- Keep setup modal opening tied to local setup errors only. External-agent setup/auth errors should surface as action errors unless they use the existing setup-required local AI markers.

## Risks / Trade-offs

- Preference normalization can exist in both shared API and test mocks -> Use helper logic that tolerates both normalized `actionEngines` and legacy `actionModelIds`.
- External-agent runs may take longer without a dedicated commit-message transcript UI -> The button loading state remains active until completion, preserving a clear busy affordance without expanding scope.
- Backend and frontend engine fallback semantics could drift -> Focus tests on global external, action external, and local deleted-model paths so regressions are visible.
