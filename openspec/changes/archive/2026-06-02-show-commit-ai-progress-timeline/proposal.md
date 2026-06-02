## Why

Commit analysis with local AI can take noticeably longer than smaller actions such as commit-message generation. The current UI only shows a generic loading state until the final structured result arrives, which makes the action feel stalled even when Gitano is doing valid work or waiting on a local model.

## What Changes

- Add a truthful progress timeline for `commitAnalysis` that reports real Gitano-controlled milestones before and during the local model run.
- Pace progress display in the frontend so fast backend milestones remain perceptible without inventing fake work.
- Preserve existing structured commit analysis results and caching behavior.
- Clear the previous progress timeline when the user refreshes an analysis.
- Defer model thinking trace/token streaming; this change does not expose LLM reasoning or raw partial model output.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `local-ai-git-analysis`: Add progress timeline behavior for commit analysis, including cache-hit and refresh behavior.

## Impact

- Frontend commit analysis modal state and rendering.
- Local AI frontend API/event types for analysis progress.
- Backend local AI command flow for emitting real commit-analysis milestones.
- Tests for cache behavior, refresh clearing, and paced progress display.
