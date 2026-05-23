## Context

Gitano currently models AI analysis around local Ollama-backed models. That works well for local-only execution, warmup, and structured outputs, but it prevents users from choosing full coding agents such as Codex CLI for deeper repository analysis.

Zed's external agent implementation shows the right boundary: the app hosts an ACP client, starts an agent process such as `codex-acp`, and streams ACP session updates into its UI. Gitano should use the same product shape: external agents are not local models and they are not direct OpenAI API calls. They are user-owned local agent processes that authenticate, bill, and share data through the user's own agent configuration.

## Goals / Non-Goals

**Goals:**

- Add a first-class analysis engine abstraction that distinguishes local models from external ACP agents.
- Add curated ACP external agents, starting with Codex CLI and using the same path for Gemini CLI and Claude Agent.
- Stream ACP agent updates into Gitano's AI analysis surfaces.
- Keep local model warmup scoped only to local-model engines, including clearing warm preferences when the active engine changes to an external agent.
- Make the privacy/account boundary visible: external agent analysis uses the user's configured agent account and may send repository context according to that agent's terms.

**Non-Goals:**

- Build a public ACP registry browser in the first version.
- Support arbitrary custom ACP agent commands in the first version.
- Reimplement Codex or call OpenAI directly from Gitano for the ACP path.
- Let external agents mutate repository files or submit remote PR feedback automatically by default.
- Replace existing local model setup, warmup, and structured analysis behavior.

## Decisions

### Decision: Model the selector as an analysis engine

Gitano should persist an engine value instead of overloading model ids:

```ts
type AnalysisEngine =
  | { type: "local_model"; modelId: string | null }
  | { type: "external_agent"; agentId: string };
```

Action-specific preferences can later extend the same shape, but the first version should make the active global analysis engine explicit. This keeps UI grouping, execution routing, cache keys, and warmup behavior simple.

Alternative considered: add ACP agents as fake model ids in existing model dropdowns. That would be fast but would blur important behavior differences: local models can be downloaded and warmed, while external agents have install/auth/session state and may use cloud services through the user's account.

### Decision: Host ACP locally instead of calling provider APIs

Gitano should run an ACP agent process and communicate over ACP session events. Codex support should go through `codex-acp` or another compatible Codex ACP adapter rather than direct OpenAI API calls.

This preserves the user's Codex configuration, authentication, approval policy, and data-sharing consent. It also keeps the implementation extensible for other ACP agents without creating provider-specific execution paths.

Alternative considered: add a native OpenAI/Codex provider. That would make Gitano responsible for credentials, billing boundaries, provider policy, and feature parity with Codex. It also would not generalize to Gemini CLI or Claude Agent.

### Decision: Use a curated external agent catalog first

The backend should expose a Gitano-owned catalog of curated external agents with stable ids, display names, install source, auth capabilities, platform support, and installed/authenticated status. Registry metadata can be used to resolve downloads or `npx` fallback, but the UI should not browse the full public registry in the first iteration.

Alternative considered: expose the whole ACP registry immediately. That adds trust, support, and UX complexity before the core Codex path is proven.

### Decision: Detect updates from curated registry metadata

Gitano should persist installed agent metadata, including installed version, install source, installed command/package, and last registry version seen. When refreshing the External Agents pane, Gitano should compare the installed version with the latest curated registry or fallback metadata and surface an `Update available` state when the curated source is newer.

The registry should be the primary update source. Running an installed adapter with `--version` can verify local state, but it should not be the only update mechanism because adapter version output may not be consistent across agents.

Alternative considered: never check for updates after install. That would keep the implementation smaller, but stale ACP adapters may lose protocol compatibility or miss provider-side fixes.

### Decision: Stream ACP updates and normalize final results

ACP prompt turns emit useful live updates: assistant text, tool calls, terminal output, plan updates, permission requests, and final stop reasons. Gitano should render these updates while the run is active, then store a Gitano-owned normalized result for the analysis surface.

The raw transcript can remain attached for debugging or future replay, but branch analysis, branch review, commit analysis, and commit message surfaces should continue rendering typed Gitano result objects where possible.

Alternative considered: wait only for the final ACP prompt response. That would lose most of the value of agent integration and make long-running Codex analysis look stalled.

### Decision: Warmup is reset when leaving local models

Warmup is a local-model feature. When the user changes the active analysis engine from a local model to an external agent, Gitano should clear persisted warm model ids and, where supported, ask the local runtime to release currently warm models. Startup warmup must also no-op unless the active engine is `local_model`.

Alternative considered: keep warm preferences in case the user switches back later. That preserves convenience but creates surprising memory usage after reopening Gitano with Codex selected.

### Decision: External agents are non-mutating by default

The first version should run external agents for analysis and review workflows without automatically applying file edits or submitting remote PR feedback. Any ACP permission request for file writes, terminal commands, or other risky actions must be shown to the user before Gitano allows it.

Alternative considered: expose full agent autonomy immediately. That is powerful, but it expands safety, undo, and trust requirements beyond the initial analysis goal.

## Risks / Trade-offs

- [Agent install drift] ACP registry metadata and agent package names may change. -> Keep a curated catalog, cache resolved versions, surface actionable install failures, and expose update availability when a newer curated version exists.
- [Auth complexity] Agents expose different auth flows. -> Treat auth as agent-owned status and actions; Gitano only displays methods and launches the requested flow.
- [Streaming noise] Agent updates can be verbose. -> Render a compact live activity timeline and keep raw transcript detail behind inspection affordances.
- [Output normalization] Agents may not return Gitano's structured JSON reliably. -> Use analysis-specific prompts and parsers, and fall back to an unstructured agent summary with a clear error when required structured data is missing.
- [Privacy expectation mismatch] External agents may send repository context to cloud services. -> Show the engine class and account boundary before execution.
- [Warmup surprise] Previously warm local models could keep consuming memory after switching to an external agent. -> Clear warm preferences and request runtime unload when feasible.

## Migration Plan

1. Migrate existing model-only preferences into `analysisEngine: { type: "local_model", modelId }`.
2. Preserve existing global and action-specific local model preferences.
3. Keep existing warm model ids only when the migrated active engine is `local_model`.
4. If the active engine is migrated or later changed to `external_agent`, clear warm model ids and skip startup warmup.
5. Rollback by reading the local-model branch of the engine preference and ignoring external-agent selections.

## Open Questions

- Should Codex be the only enabled curated agent for the first release, with Gemini CLI and Claude Agent hidden behind availability checks?
- Which external agent modes should Gitano expose initially: analysis-only, review, or agent-editing modes?
- Should external agent raw transcripts be persisted permanently or only for the current session?
- Should Gitano ship `codex-acp` itself, download it through registry metadata, or require the user to install it?
