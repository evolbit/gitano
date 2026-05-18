## 1. Backend AI Module Foundation

- [x] 1.1 Create `src-tauri/src/ai` module structure and register it from the Tauri backend.
- [x] 1.2 Define serializable local AI types for entitlement, models, machine profile, compatibility, progress, run requests, run results, findings, and cache metadata.
- [x] 1.3 Add backend local AI commands for entitlement status, model catalog, model status, compatibility checks, model preparation, model preferences, and AI action execution.
- [x] 1.4 Add focused Rust tests for type serialization and command-level error mapping.

## 2. Entitlement, Models, And Machine Compatibility

- [x] 2.1 Implement the development local AI entitlement stub with production license verification TODOs.
- [x] 2.2 Implement the curated local coding model registry with `qwen2.5-coder:7b` as the recommended default.
- [x] 2.3 Implement persisted global and per-action model preferences.
- [x] 2.4 Implement machine profile detection for OS, architecture, memory, CPU count, and model-storage disk space.
- [x] 2.5 Implement model compatibility scoring with compatible, limited, likely-too-large, insufficient-disk, and runtime-unavailable states.
- [x] 2.6 Add tests for model defaulting, preference resolution, and compatibility warning decisions.

## 3. Ollama Runtime Integration

- [x] 3.1 Add the Rust HTTP client dependency needed for local Ollama API calls.
- [x] 3.2 Implement managed runtime availability detection against the configured local endpoint.
- [x] 3.3 Implement installed model lookup using Ollama tags and return model digest and size when available.
- [x] 3.4 Implement running model lookup using Ollama process status and mark warm runners.
- [x] 3.5 Implement model pull with streamed progress events keyed by operation id.
- [x] 3.6 Implement model generation with JSON response parsing and user-facing failure messages.
- [x] 3.7 Add tests with mocked Ollama responses for tags, running models, pull progress, and generation failures.
- [x] 3.8 Implement Gitano-managed runtime download, extraction, startup, readiness polling, and app-scoped model storage.

## 4. Git Context, Prompts, And Cache

- [x] 4.1 Implement Git context snapshots for staged commit message generation.
- [x] 4.2 Implement Git context snapshots for commit analysis by commit SHA.
- [x] 4.3 Implement Git context snapshots for branch and PR-style comparison analysis.
- [x] 4.4 Implement Git context snapshots for merge conflict suggestions from unmerged files.
- [x] 4.5 Implement prompt templates, prompt versions, response schemas, and structured result parsing for each action.
- [x] 4.6 Implement deterministic context budgeting with omitted-context metadata.
- [x] 4.7 Implement digest-aware analysis caching by action, prompt version, model digest, repository identity, and Git input digest.
- [x] 4.8 Add Rust tests for Git input digests, cache hits/misses, and context budgeting.

## 5. Frontend Local AI API And State

- [x] 5.1 Add typed frontend local AI API adapters that centralize all new Tauri command names and payloads.
- [x] 5.2 Add frontend local AI types that mirror backend request, status, progress, compatibility, and result contracts.
- [x] 5.3 Add a local AI store or feature state module for entitlement, selected models, setup operations, progress, and cached UI state.
- [x] 5.4 Add tests that verify frontend adapters call the expected Tauri commands with stable payload shapes.

## 6. Model Setup And Settings UI

- [x] 6.1 Build the local AI setup surface for premium state, runtime availability, selected model, and model readiness.
- [x] 6.2 Render determinate download percentage when progress includes byte totals.
- [x] 6.3 Render indeterminate progress with status text when progress lacks byte totals.
- [x] 6.4 Render compatibility warnings with required and available machine resources.
- [x] 6.5 Allow explicit override for slow or likely-too-large models while blocking insufficient disk and routing missing runtime through managed setup.
- [x] 6.6 Add model switching controls for global default and per-action preferences.
- [x] 6.7 Add setup UI tests for progress, compatibility warnings, model switching, and setup-required states.

## 7. Workflow Entry Points

- [x] 7.1 Add local AI commit message generation to the current changes commit box.
- [x] 7.2 Route commit message generation through setup when the selected model is not ready.
- [x] 7.3 Fill the editable commit message field with generated text while keeping commit execution manual.
- [x] 7.4 Add local AI commit analysis to the commit row context menu and result display.
- [x] 7.5 Add local AI branch and PR-style analysis to the branch comparison modal.
- [x] 7.6 Add local AI merge conflict suggestion entry point when conflict state is visible.
- [x] 7.7 Add UI tests for each workflow entry point and setup routing path.

## 8. Verification And Documentation

- [x] 8.1 Run Rust unit tests for backend AI, Git context, and cache behavior.
- [x] 8.2 Run frontend unit tests for adapters, setup UI, and workflow entry points.
- [x] 8.3 Run the project build and fix type, lint, or integration issues.
- [ ] 8.4 Manually verify setup with missing managed runtime, installed recommended model, download progress, model switching, cache hit, and cache refresh flows.
- [x] 8.5 Document local AI development setup, model defaults, entitlement stub behavior, and known runtime limitations.
