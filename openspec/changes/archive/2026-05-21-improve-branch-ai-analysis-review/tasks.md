## 1. Local AI Action Model

- [x] 1.1 Add a distinct `branchReview` local AI action kind across backend and frontend API types.
- [x] 1.2 Add structured branch analysis fields for behavioral changes, potential regressions, test gaps, recommendations, and action items.
- [x] 1.3 Add structured branch review result types for anchored findings, unanchored notes, severity, confidence, impact, recommendation, and suggested PR comment text.
- [x] 1.4 Ensure cache keys distinguish branch analysis from branch review while still using the active comparison input digest.

## 2. Backend Context, Prompts, and Parsing

- [x] 2.1 Extend branch Git context construction so branch analysis has enough report context without relying on a raw file-list output.
- [x] 2.2 Extend branch Git context construction for branch review so prompts preserve file path, side, and changed-line information needed for anchor matching.
- [x] 2.3 Replace the generic branch analysis prompt with a report-oriented prompt that asks for risks, regressions, recommendations, and action items.
- [x] 2.4 Add a branch review prompt that asks for PR-review-style changed-line findings and forbids generic changed-file summaries.
- [x] 2.5 Parse branch analysis and branch review JSON into Gitano-owned result types with safe defaults for missing optional fields.
- [x] 2.6 Add backend tests for branch analysis parsing, branch review parsing, invalid/missing anchors, and cache key separation.

## 3. Run Progress

- [x] 3.1 Generalize local AI run progress events so branch analysis and branch review can emit progress with run ids.
- [x] 3.2 Emit truthful branch milestones: resolving refs, determining diff base, reading comparison diff, checking cache, cache hit, running local model, formatting result, completed, and failed.
- [x] 3.3 Preserve cache-hit and refresh-bypass behavior for branch analysis and branch review progress.
- [x] 3.4 Add tests for branch AI progress events and stale run id handling where practical.

## 4. Branch Comparison UI

- [x] 4.1 Replace the single branch Analyze button with distinct Analyze and Review actions or an AI menu containing both actions.
- [x] 4.2 Wire branch analysis to the progress timeline and render the deeper report without the changed-file chip list.
- [x] 4.3 Wire branch review to the progress timeline and render review findings separately from branch analysis.
- [x] 4.4 Clear stale branch analysis and branch review state when base branch, source branch, comparison mode, or modal session changes.
- [x] 4.5 Preserve local AI setup routing for both branch analysis and branch review.

## 5. AI Review Feedback Workflow

- [x] 5.1 Match branch review findings to loaded diff lines by file path, side, and changed-line number before showing inline feedback.
- [x] 5.2 Show invalid or non-line-specific findings as unanchored review notes instead of inline comments.
- [x] 5.3 Add controls to apply an anchored AI finding as a bot-authored draft review thread.
- [x] 5.4 Add controls to dismiss AI review findings for the current modal session.
- [x] 5.5 Add copy-to-clipboard output for selected AI review feedback as PR-ready Markdown.
- [x] 5.6 Ensure applied AI draft comments remain editable and removable through the existing review comment UI.

## 6. Verification

- [x] 6.1 Add or update frontend tests for the two branch AI actions, progress rendering, stale-state clearing, and setup routing.
- [x] 6.2 Add or update frontend tests for applying, dismissing, copying, and anchor-validating AI review findings.
- [x] 6.3 Run focused Rust tests for local AI context, prompts, parsing, caching, and progress.
- [x] 6.4 Run focused frontend tests for local AI API, branch comparison modal, result modal, and review comments.
- [ ] 6.5 Manually verify that branch analysis returns a useful report and branch review returns actionable changed-line feedback on a realistic branch comparison.
