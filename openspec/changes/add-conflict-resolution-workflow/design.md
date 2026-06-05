## Context

Gitano already has a Current Changes explorer, an inline working-tree diff surface, staged-line state, and a repository-wide AI action for merge conflict suggestions. The current working-changes path is built around normal Git diffs and line staging, while Git conflicts are represented by unmerged index stages that do not fit the same model. Treating unmerged files as `modified` would make dangerous actions such as normal staging, unstaging, and discard look available even though the file needs a resolution workflow.

The workflow should stay feature-owned under `src/features/working-changes` because conflicts are discovered from the working tree and index. Shared adapters and cross-boundary types should live under `src/shared/api/git` and `src/shared/types`, and Rust conflict commands should live in a small `src-tauri/src/git/conflicts` module.

## Goals / Non-Goals

**Goals:**

- Show unresolved conflicts explicitly in Current Changes.
- Open a dedicated conflict resolution surface when a conflict file is selected.
- Keep top `Incoming` and `Current` panes read-only and show full file context when safe.
- Use lazy-loaded Monaco only for the editable result panel.
- Make large and very large conflict files responsive through virtualization and range loading.
- Support per-conflict and per-file AI fix candidates without auto-writing files.
- Validate writes and AI applications against conflict signatures to avoid stale edits.
- Handle non-standard conflict shapes with clear fallback states.
- Keep files split by responsibility and follow the existing feature/shared/backend boundaries.

**Non-Goals:**

- Replacing the existing normal diff viewer with Monaco.
- Adding a global file editor for all Current Changes.
- Auto-resolving all repository conflicts in one AI action.
- Silently applying AI output or external-agent output to the worktree.
- Supporting semantic three-way merge algorithms beyond Git's available base/current/incoming content in this change.
- Implementing rich language-server behavior in the result editor.

## Decisions

### Decision: Conflicts are first-class working-change state

The backend should expose a `conflicted` file status or conflict-specific summary type instead of letting the frontend normalize unmerged statuses to `modified`. Current Changes should render a `Conflicts` section above normal tracked/untracked sections and should disable normal staging checkboxes and normal line-staging behavior for unresolved conflict rows.

Alternative considered: Keep conflicts in the tracked section as modified files. That keeps the explorer simpler but makes unresolved index stages look like ordinary diffs and creates confusing stage/unstage behavior.

### Decision: Backend owns index-stage interpretation

Rust commands should read conflict data from Git's unmerged index and return labeled content:

- `base`: stage 1 when present
- `current`: stage 2, labeled `Current`
- `incoming`: stage 3, labeled `Incoming`
- `result`: current worktree file content

The UI should avoid presenting `ours` and `theirs` as primary labels because those terms are especially confusing during rebase, cherry-pick, and revert. Backend responses should include conflict kind metadata for add/add, modify/delete, deleted/current, missing-stage, binary, symlink, and submodule cases.

Alternative considered: Parse conflict markers only from the worktree file in TypeScript. That misses conflicts without markers, does not expose clean base/current/incoming content, and forces frontend code to understand Git index stages.

### Decision: Dedicated right-workspace conflict mode

Selecting a conflicted file from Current Changes should switch the repository right workspace to a conflict resolution mode rather than the normal `working-diff` mode. This keeps normal diff staging logic unchanged and lets the conflict surface own its toolbar, read-only panes, result editor, AI actions, and mark-resolved flow.

Alternative considered: Extend `InlineDiffSurface` with conflict-specific branches. That would couple normal diff rendering, staging, and conflict resolution into one component and make both paths harder to test.

### Decision: Result panel is the only editable pane and starts from a safe projection

The `Incoming` and `Current` panes should be read-only full-file context panes. The bottom `Result` pane is the only editable surface. For normal text conflicts with a base stage, the initial visible result should be a projection of the worktree result where unresolved conflict-marker blocks are replaced with base/no-change content. That matches VS Code's merge editor behavior and avoids showing marker noise as the primary editing surface. Conflicts without a base stage, such as add/add, should continue to start from the raw worktree result.

The result projection is still written back through the normal result-save path once the user accepts sides, applies AI, or edits content. Because a base projection removes conflict markers from the visible result, the frontend must also track unresolved projected regions and block `Mark resolved` until those regions are accepted, edited, or otherwise replaced.

Display-only alignment rows may be inserted through editor view zones when the projected result region has fewer visible lines than a side's conflict content. Those rows are visual padding only and must never become saved file content.

Alternative considered: Make all panes editable. That mirrors some IDE internals but makes it unclear which content is persisted and increases the risk of writing to the wrong side.

### Decision: Lazy-load Monaco for supported merge-editor panes

Use `@monaco-editor/react` inside the conflict resolution surface for supported text conflicts so incoming/current panes and the result panel share syntax coloring, scroll behavior, decorations, and editor view-zone support. Load it lazily when a conflict resolution surface opens. Unsupported content such as binary files, symlinks, submodules, and very large files that exceed editing limits should show fallback metadata and external-editor guidance.

Alternative considered: Introduce Monaco for all Current Changes. That adds bundle, worker, lifecycle, and UX complexity to normal diff/staging workflows that do not need a full editor.

### Decision: Size classes are explicit constants

Conflict rendering should classify text files with named constants:

- `NORMAL_TEXT_LINE_LIMIT = 5_000`
- `VERY_LARGE_TEXT_LINE_LIMIT = 50_000`
- `NORMAL_TEXT_BYTE_LIMIT = 1_000_000`
- `VERY_LARGE_TEXT_BYTE_LIMIT = 10_000_000`

Files at or below the normal limits can load full text directly. Files above normal limits should virtualize full-file read-only panes. Files above very-large limits should use range-loaded virtualized read-only panes and avoid file-wide AI unless explicitly requested and safely bounded.

Alternative considered: Base the behavior only on byte size or only on line count. Both miss important cases: minified files can be byte-heavy with few lines, while generated line-oriented files can be line-heavy but not byte-heavy.

### Decision: Conflict APIs are separate from normal diff APIs

Add typed conflict commands instead of overloading normal diff/staging commands:

- list conflicted file summaries
- load conflict file detail and metadata
- load line ranges for very large conflict panes
- write result content with an expected signature
- accept a side for a conflict region or whole file where supported
- mark the file resolved

Normal `stageFile`, `stageLines`, and diff hunk commands should not be used to resolve unmerged index entries.

Alternative considered: Reuse `git add_file` directly from the UI. That marks a file resolved but does not provide safe stale checks, content validation, or conflict-specific feedback.

### Decision: AI returns reviewable candidates

Keep AI under the existing Git AI engine selection and entitlement model, but make conflict requests scope-aware:

- per-conflict action: returns a replacement candidate for one conflict region
- per-file action: returns a full result candidate for one conflicted file

The frontend should show the candidate against the current result and require an explicit apply action. Applying a candidate should validate the same conflict/result signature used by manual saves. AI output must never be written automatically after generation.

Alternative considered: Auto-apply AI fixes. That is faster when correct but creates high-risk silent writes to conflicted files and makes stale output dangerous.

### Decision: External edits invalidate conflict details and AI candidates

Conflict detail responses should include an unmerged-index signature and result/worktree signature. Writes, accept-side actions, mark-resolved actions, and AI candidate applications should require the expected signature. If the file or index changed externally, the action should fail with a reloadable stale-state error.

Alternative considered: Last-write-wins editing. That can overwrite manual editor work or apply AI output to a different conflict state.

### Decision: Split implementation by responsibility

The frontend should avoid a large coordinator file by splitting responsibilities:

- conflict list/loading hooks
- conflict detail hooks
- conflict surface shell
- read-only pane renderer
- result editor
- toolbar/navigation
- AI runner
- size classification utilities
- signature and language utilities

Backend code should similarly split list, detail, resolve, and types into a `git/conflicts` module.

Alternative considered: Build the feature in one large component and split later. The workflow has enough independent concerns that starting split is cheaper and easier to test.

## Risks / Trade-offs

- Stage labels are easy to misunderstand -> Use `Current` and `Incoming` in the UI and keep stage-number details inside backend/domain types.
- Conflict marker parsing can be wrong -> Treat Git index stages as source of truth and use marker parsing only to help align visible conflict regions in the worktree result.
- Monaco increases bundle and worker complexity -> Lazy-load it only inside the result editor and add a simple fallback for unsupported content.
- Large files can still be expensive -> Return metadata first, virtualize top panes, and use range-loaded APIs for very large files.
- AI can produce invalid or stale output -> Require explicit user application and signature validation before writing.
- External editors can change files mid-resolution -> Invalidate details and candidates when signatures change and show reload paths.
- Modify/delete and add/add conflicts do not fit symmetric panes -> Return conflict kind metadata and render tailored actions instead of forcing a generic two-pane text merge.
- Line ending or final-newline changes can surprise users -> Return line-ending metadata and preserve the result file's detected line ending when writing unless user content explicitly changes it.
- Feature scope can sprawl into a full IDE editor -> Keep v1 to conflict resolution only and defer global editing, language-server features, and repository-wide AI auto-fix.

## Migration Plan

1. Add backend conflict listing/detail commands and shared typed adapters without changing existing working-diff behavior.
2. Add `conflicted` status/domain types and render conflict summaries in Current Changes.
3. Add the right-workspace conflict mode and read-only conflict surface.
4. Add result editing, save, accept-side, and mark-resolved flows.
5. Add scoped AI candidate generation and explicit apply behavior.
6. Add large-file virtualization/range loading and unsupported-file fallbacks.
7. Remove or demote the existing repository-wide commit-menu conflict suggestion entry if the new conflict surface supersedes it.

Rollback is straightforward until commands are wired into UI: hide the conflict surface entry points and keep conflicts visible as disabled conflict rows with external-editor guidance. No repository data migration is required.

## Open Questions

- Should the existing repository-wide `Suggest conflicts` commit-menu action remain as a summary action after scoped AI ships, or should it be removed from v1 UI?
- Should `Mark resolved` warn when common conflict marker strings remain in the result, or only rely on the user's explicit action?
- What is the exact editing cutoff for Monaco in very large result files after measuring Tauri/Mac performance?
