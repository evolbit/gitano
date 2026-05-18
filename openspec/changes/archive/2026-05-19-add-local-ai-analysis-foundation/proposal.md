## Why

Gitano can make premium AI features valuable without sending repository data to a remote service by running code-focused models locally. This change establishes the local AI foundation first, so model setup, entitlement, caching, and Git analysis actions are consistent before additional AI workflows are added.

## What Changes

- Add a premium-gated local AI setup flow backed by a Rust/Tauri model-management layer.
- Add a curated local model registry with a recommended default, larger quality-oriented choices, installed/running status, and user-selectable defaults.
- Add managed runtime setup, model download progress, model digest detection, runner reuse, and machine compatibility warnings before download or first run.
- Add a temporary entitlement stub with TODOs for signed license verification, while enforcing the gate at the backend command boundary.
- Add local AI Git analysis actions for commit analysis, branch/PR-style analysis, merge conflict suggestions, and commit message generation.
- Add structured AI result caching keyed by action, repository input digest, prompt version, and selected model digest.
- Add first UI entry points for generating commit messages, analyzing commits, and running branch comparison analysis.

## Capabilities

### New Capabilities
- `local-ai-model-management`: Covers premium local AI entitlement, model registry, compatibility checks, downloads, progress reporting, installed model metadata, running model detection, and model selection.
- `local-ai-git-analysis`: Covers local AI Git actions, Git context snapshots, structured analysis outputs, digest-aware caching, manual execution, and first supported analysis workflows.

### Modified Capabilities
- `commit-box-push-workflow`: Add premium local AI commit message generation from the staged change set.
- `commit-row-context-menu`: Add premium local AI commit analysis from commit context menus.
- `branch-comparison-review`: Add premium local AI branch comparison analysis to the branch comparison review surface.

## Impact

- Rust/Tauri: new AI modules for entitlement, model registry, managed runtime setup, Ollama integration, machine profiling, Git context extraction, prompt execution, and cache persistence.
- Frontend API: new typed local AI adapters under the shared API/platform boundary.
- Frontend features: local AI setup/settings UI, commit message generation control, commit analysis action, and branch comparison analysis panel.
- Runtime dependency: Gitano-managed local runtime and downloaded model files; implementation should detect setup failures and guide the user without crashing.
- Persistence: managed runtime files, model files, model preference, and analysis cache metadata should be stored locally and invalidated by model digest, prompt version, and Git input digest.
