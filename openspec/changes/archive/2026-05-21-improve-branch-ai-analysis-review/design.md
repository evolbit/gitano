## Context

Branch comparison already has three important pieces in place:

- A modal that shows changed files and file diffs for a selected base/head comparison.
- Draft-only GitHub-style review threads anchored to diff lines.
- Local AI infrastructure for model selection, local inference, structured JSON parsing, digest caching, and commit-analysis progress events.

The current branch AI analysis uses the generic analysis prompt and result shape. In practice that can produce a shallow report that repeats file paths already visible in the comparison and does not produce useful PR feedback. The desired workflow has two different jobs:

```text
Branch comparison
  -> Analyze branch
     -> Deep report: intent, risk, behavior, tests, recommendations, action items

  -> Review changed code
     -> Line-anchored findings: possible bugs, regressions, missing tests,
        unsafe assumptions, suggested PR comments
```

These jobs should be separate local AI actions because they need different prompts, result schemas, UI affordances, and cache entries.

## Goals / Non-Goals

**Goals:**

- Preserve branch analysis as a report, but make it materially deeper and remove the changed-file chip list.
- Add a separate branch review action that behaves like local PR-review assistance.
- Anchor review findings to real changed diff lines before showing them as actionable feedback.
- Let the user apply, edit, dismiss, or copy AI review feedback instead of automatically posting or persisting it.
- Reuse the commit-analysis progress timeline pacing model for branch analysis and branch review with truthful backend milestones.
- Clear stale AI analysis and review state whenever comparison inputs change.
- Keep frontend orchestration thin; backend owns prompt construction, context budgeting, structured result shape, and cache keys.

**Non-Goals:**

- Persist AI review comments to a remote PR provider.
- Automatically submit AI comments without user review.
- Stream raw model tokens or model reasoning traces.
- Claim file-by-file progress unless backend actually performs file-by-file work.
- Replace manual review comments or existing draft review thread editing.

## Decisions

### Decision: Use two branch AI actions

Use separate action kinds for `branchAnalysis` and `branchReview`.

`branchAnalysis` answers: "What does this branch change, what risks should I understand, and what should I check before approval?"

`branchReview` answers: "Which changed lines need PR-review feedback?"

Alternative considered: keep one branch action with a richer combined output. Rejected because report-style analysis and PR review comments have different success criteria. Combining them makes the prompt less precise and encourages mixed output, such as generic summaries inside review findings.

### Decision: Make branch review line anchored

Branch review findings should include a required file path, changed-line side, line number, severity, confidence, explanation, impact, recommendation, and suggested comment. Findings without a valid changed-line anchor should be shown as general review notes or dropped from inline rendering.

Alternative considered: allow file-level findings only. Rejected because the target workflow is PR feedback, and useful PR comments need to point reviewers to concrete changed code.

### Decision: Validate findings against the diff before rendering inline

The frontend should not blindly trust model-provided anchors. It should match each finding to the loaded branch comparison diff by file path, side, and line number before rendering it as an inline review candidate. Unmatched findings can remain in the review result summary as unanchored notes, but they must not appear as diff-line comments.

Alternative considered: render all model anchors directly. Rejected because invalid anchors make the review feel unreliable and can attach feedback to the wrong code.

### Decision: Use draft review threads as the application target

Applying an AI review finding should create or update a bot-authored draft review thread in the existing branch comparison modal session. The user can edit, reply, resolve, delete, or copy the comment using the existing review-comment UI patterns.

Alternative considered: create a separate AI-only comment surface. Rejected because it would duplicate the review thread model and make the feedback harder to turn into PR-ready comments.

### Decision: Keep branch analysis report-oriented

Branch analysis should not show a raw changed-file chip list. It should show a report with summary, risk assessment, behavioral changes, potential regressions, test gaps, recommendations, and action items. Files may be mentioned only when they explain a specific risk or action item.

Alternative considered: keep changed areas but ask the model not to use file paths. Rejected because the modal already shows changed files and the section invites low-value output.

### Decision: Generalize local AI run progress

Run progress events should support branch analysis and branch review using branch-specific milestones:

```text
Resolving comparison refs
Determining diff base
Reading comparison diff
Checking cache
Using cached result
Running local model
Formatting result
Analysis complete / Review complete
```

The frontend should keep the existing paced timeline behavior and ignore stale events by run id.

Alternative considered: show the existing generic loading text for branch runs. Rejected because branch review can take as long as commit analysis and users need the same sense of progress and cache behavior.

## Risks / Trade-offs

- [False positives] -> Require confidence and actionable recommendations, keep findings as drafts, and let the user dismiss or edit them.
- [Invalid line anchors] -> Validate anchors against loaded diff lines before inline rendering.
- [Large branch diffs exceed model budget] -> Use deterministic context budgeting and disclose omitted files or sections in result metadata.
- [Shallow model output] -> Use action-specific prompts and structured schemas that require evidence, impact, and action items.
- [Stale results after base/head changes] -> Track run ids and comparison pair keys; clear results when comparison inputs change.
- [UI clutter from many AI findings] -> Show a review findings panel with filtering and explicit apply actions instead of auto-expanding every finding inline.
