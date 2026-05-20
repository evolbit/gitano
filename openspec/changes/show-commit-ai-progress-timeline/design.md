## Context

`commitAnalysis` currently follows a synchronous request/response path:

```text
Commit context menu
  -> runCommitAiAnalysis()
  -> runLocalAiAction()
  -> Tauri ai_run_action
  -> build Git context
  -> check/cache/generate/parse
  -> LocalAiResultModal renders final structured result
```

This hides useful state until the final result returns. During exploration, we decided not to stream model tokens or thinking traces for the first iteration. Instead, Gitano should show real application milestones and pace their presentation.

## Goals / Non-Goals

**Goals:**
- Show a progress timeline while commit AI analysis is running.
- Use only truthful Gitano-controlled milestones.
- Preserve cached analysis unless the user explicitly refreshes.
- Clear and restart progress on refresh.
- Keep the final output as the existing structured analysis result.
- Pace fast progress steps so users can perceive them.

**Non-Goals:**
- Stream raw LLM response tokens.
- Stream model reasoning/thinking traces.
- Simulate file-by-file analysis unless Gitano actually performs file-by-file work.
- Change branch analysis, merge-conflict suggestions, or commit-message generation UX in this first change.

## Progress Model

Backend milestones should describe work Gitano actually controls:

```text
Resolving commit
Reading commit diff
Checking cache
Using cached analysis
Running local model
Formatting analysis
Analysis complete
```

The frontend may reveal these milestones with a small minimum interval, for example 300-500ms, so a fast sequence does not flash by unreadably.

```text
Backend emits quickly:
resolvingCommit -> readingCommitDiff -> checkingCache -> runningModel

Frontend reveals:
0ms    Resolving commit
400ms  Reading commit diff
800ms  Checking cache
1200ms Running local model
```

## Cache Behavior

Normal analyze should use the existing cache:

```text
Resolving commit
Reading commit diff
Checking cache
Using cached analysis
```

Refresh should clear the previous timeline and bypass the cache:

```text
Resolving commit
Reading commit diff
Checking cache
Running local model
Formatting analysis
Analysis complete
```

If cache lookup succeeds, Gitano should not show `Running local model`.

## UI Behavior

The commit analysis modal should replace the generic loading-only body with a progress timeline while loading. Once the structured result arrives, the modal should render the existing summary/risk/findings UI.

While the model is running, the UI may show elapsed time and neutral waiting copy:

```text
Running local model · 18s
Local models can take longer the first time they wake up.
```

The UI must not claim unobserved actions such as `Reading src/file.ts` unless the backend actually performs those steps.

## Event / API Shape

A narrow event type is enough:

```ts
type LocalAiRunProgress = {
  runId: string;
  actionKind: "commitAnalysis";
  state:
    | "resolvingCommit"
    | "readingCommitDiff"
    | "checkingCache"
    | "cacheHit"
    | "runningModel"
    | "formattingResult"
    | "completed"
    | "failed";
  message: string;
};
```

`runId` lets the frontend ignore stale events from an older request after refresh or close.

## Risks / Trade-offs

- Fast backend stages may still feel brief. Use frontend pacing, but avoid delaying final results noticeably.
- Cache is currently expected by the spec; implementation should ensure cache read/write paths are active for normal analysis and bypassed only on refresh.
- Adding progress events to the existing `ai_run_action` may affect all AI actions if done broadly. Prefer scoping emitted milestones to `commitAnalysis` first.
- If the user closes the modal mid-run, the backend request may continue. The frontend should ignore stale progress/result updates for closed or superseded runs.
