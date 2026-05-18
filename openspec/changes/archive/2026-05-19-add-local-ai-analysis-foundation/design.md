## Context

Gitano already has a clear split between React workflow surfaces, typed frontend adapters, and Rust/Tauri commands that own Git operations. Local AI should follow the same shape: the frontend presents setup, model selection, progress, and results, while Rust owns entitlement checks, machine compatibility, Ollama communication, Git context snapshots, prompt execution, and cache keys.

The first runtime backend will be a Gitano-managed Ollama runtime on `localhost:11435` with `qwen2.5-coder:7b` as the recommended default. The foundation must still support multiple curated local models, because users may choose a faster model for commit messages or a larger model for branch/PR analysis when they are willing to wait.

## Goals / Non-Goals

**Goals:**
- Add a backend-enforced premium gate for local AI commands, with a development stub and TODOs for signed license verification.
- Add a curated local model registry with size, context, quality tier, minimum/recommended machine guidance, and action suitability.
- Detect managed runtime availability, installed model metadata, model digests, running models, disk availability, and basic machine profile.
- Download and start the managed local AI runtime during setup when it is missing.
- Stream model download progress to the frontend with percentages when bytes are available and status text when only phase updates are available.
- Warn users when a selected model is likely too large or disk space is insufficient, and offer a smaller compatible model when possible.
- Store managed runtime files and model weights under Gitano local AI data by default.
- Let users switch default models and per-action model preferences.
- Add local AI actions for commit messages, commit analysis, branch/PR-style analysis, and merge conflict suggestions.
- Cache analysis results by action, prompt version, model digest, and Git input digest.

**Non-Goals:**
- Implement cloud AI fallback or send repository content to remote AI providers.
- Implement direct llama.cpp/GGUF inference in this first foundation; managed Ollama is the initial app-owned runtime adapter.
- Auto-install GPU drivers or system services for Ollama.
- Implement payment processing or production license verification in this change.
- Persist PR review comments to a remote forge.
- Apply merge conflict resolutions automatically; the first conflict workflow generates suggestions only.

## Decisions

### Decision: Rust owns AI orchestration

Add a backend `ai` module under `src-tauri/src/ai` and register Tauri commands from `main.rs`. The module should contain:

- `commands.rs`: Tauri command boundary and event emission.
- `entitlement.rs`: premium status check, initially a development stub.
- `models.rs`: curated model registry and model preference persistence.
- `machine.rs`: machine profile, disk checks, and compatibility scoring.
- `ollama.rs`: Ollama HTTP client for tags, running models, pull, and generate.
- `git_context.rs`: Git snapshots for each action.
- `prompts.rs`: prompt versions, system prompts, action schemas, and response parsing.
- `cache.rs`: local result cache keyed by model digest and Git input digest.
- `types.rs`: shared serializable request/response models.

Alternative considered: keep Ollama calls in React. That would make streaming easy but would expose entitlement bypasses, duplicate Git context loading, and push model/runtime details into workflow components.

### Decision: Use Ollama as an adapter, not as the domain model

Commands should return Gitano-owned types such as `LocalAiModelStatus`, `LocalAiDownloadProgress`, and `LocalAiRunResult`. Ollama details stay behind `ollama.rs`.

Alternative considered: expose raw Ollama API responses to the frontend. That would speed up the first implementation but make later changes to a bundled runner, llama.cpp, or another local engine harder.

### Decision: Gitano owns the first runtime boundary

The setup flow should download a Gitano-managed Ollama runtime when one is missing, start it on `127.0.0.1:11435`, and set `OLLAMA_MODELS` to `<local-ai-data>/models/ollama`. This makes the product flow "download local AI" rather than "install Ollama yourself", while preserving Ollama's model pull API and streaming progress behavior.

If `OLLAMA_HOST` is set, Gitano treats it as an explicit development override and uses that external runtime instead. In that mode model placement is controlled by the external runtime.

Alternative considered: direct llama.cpp/GGUF integration now. That is the cleaner long-term runtime shape, but it requires model-file selection, chat template handling, native build/package work, and per-platform acceleration decisions. A managed Ollama runtime gives the app-owned setup flow immediately and can later be swapped behind the existing adapter.

### Decision: Curated registry with overridable preferences

Ship a curated registry:

- `qwen2.5-coder:3b`: fast option for small diffs and commit messages.
- `qwen2.5-coder:7b`: recommended default for balanced code analysis.
- `qwen2.5-coder:14b`: higher-quality option for users willing to wait.
- `qwen2.5-coder:32b`: maximum Qwen2.5 local quality for powerful machines.
- `qwen3-coder:30b`: experimental long-context option for powerful machines.

The frontend should let users choose a global default and optional per-action defaults. If no preference exists, use the action default from the registry.

Alternative considered: only support one model. That makes caching simpler, but it ignores the core product need: users have very different hardware and patience budgets.

### Decision: Compatibility warnings are advisory except disk/runtime blockers

Compatibility levels:

- `compatible`: no warning.
- `limited`: allowed with speed/context warning.
- `likelyTooLarge`: allowed only after explicit confirmation.
- `insufficientDisk`: blocked until enough disk is available.
- `runtimeUnavailable`: setup can continue by downloading and starting the managed runtime, unless the current platform is unsupported.

Memory requirements should warn rather than hard-block because CPU inference may still work slowly. Disk space should block because the model cannot be pulled. Runtime unavailability should route through managed runtime setup; only unsupported platforms or failed runtime setup should block.

Alternative considered: hard-block models that exceed memory recommendations. That would prevent some advanced users from accepting slower local inference.

### Decision: Stream progress events by operation id

`ai_prepare_model` should accept a model id and return an operation id, then emit typed progress events keyed by that id. If the managed runtime is missing, setup first downloads and extracts it, starts it, waits for readiness, and then pulls the selected model. The UI should show this as two clear phases: `Downloading runtime...` and then `Downloading model <model-id>...`. Progress is calculated from streamed runtime or model byte counts when available; otherwise the UI shows status text and an indeterminate bar. Completion refreshes installed model status from Ollama tags.

Alternative considered: make the command block until the download finishes. That would simplify the API but would make large model downloads feel frozen and would make cancellation harder later.

### Decision: Cache AI results by exact model and exact Git input

Each run computes:

- `actionKind`
- `promptVersion`
- selected model id
- installed model digest
- repository path hash
- action-specific Git input digest

Commit analysis uses commit SHA plus prompt version and model digest. Branch/PR analysis uses resolved base SHA, head SHA, comparison mode, changed file summary, and included diff digest. Commit message generation uses staged tree state and staged diff digest. Conflict suggestions use unmerged path list and stage/blob digests.

Alternative considered: key commit and branch analysis only by SHA. That misses model upgrades, prompt changes, and selected-model changes.

### Decision: Structured results first, prose second

Prompt responses should be requested as JSON and parsed into Gitano-owned result types. The UI can render summaries, findings, suggested comments, and generated commit messages without scraping prose.

Alternative considered: store raw Markdown only. That is easier initially but prevents reusable result rendering, finding counts, severity filters, and future review-thread conversion.

## Risks / Trade-offs

- Managed runtime download can fail because of network, platform, or extraction issues -> setup emits a failed progress state with the concrete error.
- External Ollama may still be useful in development -> `OLLAMA_HOST` remains an explicit override, but the default product path is managed by Gitano.
- Large models download slowly -> progress events show phase, bytes, percentage when possible, and allow the user to leave the setup surface while the operation continues.
- Hardware detection is imperfect -> compatibility uses conservative warnings and explicit override instead of pretending it can perfectly predict performance.
- Local models hallucinate or overstate findings -> prompts require evidence tied to files/lines where possible, and UI labels results as AI suggestions.
- Diffs can exceed context windows -> Git context extraction applies file and token budgets, summarizes omitted files, and tells the model what was omitted.
- Cache could return stale results -> cache keys include prompt version, model digest, and Git input digest; users can force refresh.
- License gating in a local app is bypassable -> first implementation uses a backend gate and TODO license verifier, but production monetization requires signed receipt validation and server-issued entitlements.

## Migration Plan

1. Add backend AI modules and commands behind a development entitlement stub.
2. Add typed frontend AI adapters and model setup/settings UI.
3. Add model registry, compatibility warnings, download progress events, and model preference persistence.
4. Add structured AI execution and cache storage.
5. Add commit message generation and commit analysis entry points.
6. Add branch comparison analysis entry point.
7. Add merge conflict suggestion command and UI entry point where conflict state is visible.

Rollback can remove or hide AI entry points while leaving core Git workflows unchanged, because AI commands are additive and do not mutate Git state except for filling editable UI text such as commit messages.

## Open Questions

- Should production builds require a signed local license file, a remote entitlement refresh, or both?
- Should Gitano replace managed Ollama with a direct llama.cpp/GGUF runtime after the premium flow is validated?
- What exact hardware thresholds should be tuned after testing on representative Mac, Windows, and Linux machines?
- Should branch/PR analysis results be convertible into draft review threads in this first implementation, or remain in a separate AI analysis panel?
