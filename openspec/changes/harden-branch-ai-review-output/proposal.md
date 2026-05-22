## Why

Branch AI review can appear to return nothing when using Phi, even for diffs where a useful review should be possible. Exploration showed that Gitano currently accepts structurally empty local-model JSON as a successful branch review, silently drops malformed inline findings, and may budget prompts from a model's advertised context window while sending a smaller effective `num_ctx` to Ollama.

## What Changes

- Harden branch review parsing so unusable model output is surfaced as an error instead of a successful empty review.
- Preserve useful model feedback by converting unanchored or invalid inline findings into review notes when enough content exists.
- Align local AI prompt budgeting with the effective context window sent to Ollama, including reserved response space for structured JSON.
- Make context omission and truncation visible in branch AI result surfaces so users can understand degraded output.
- Bump the local AI prompt/cache version so stale empty cached branch AI results are not reused.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `branch-ai-review`: Tighten the contract for empty branch review output and invalid/unanchored finding handling.
- `local-ai-git-analysis`: Align context budgeting with runtime generation options and require unusable structured outputs to fail clearly.
- `branch-comparison-review`: Surface branch review output degradation and context omission in the review UI.

## Impact

- Backend local AI prompt budgeting and Ollama generation options in `src-tauri/src/ai/git_context.rs` and `src-tauri/src/ai/ollama.rs`.
- Backend structured response parsing and validation in `src-tauri/src/ai/prompts.rs`.
- Local AI cache invalidation through `PROMPT_VERSION`.
- Branch comparison and local AI result rendering in `src/features/branches/branch-compare-modal.tsx` and `src/features/local-ai/local-ai-result-modal.tsx`.
- Focused Rust and frontend tests for empty Phi-style responses, invalid anchors, metadata display, and context-budget alignment.
