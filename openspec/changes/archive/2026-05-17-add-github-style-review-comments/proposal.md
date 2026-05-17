## Why

Branch comparison comments currently render as plain inline text boxes. They do not match the GitHub-style review workflow users expect for code review: threaded comments, replies, Write/Preview Markdown editing, toolbar-assisted Markdown insertion, and emoji insertion.

## What Changes

- Replace the flat one-comment-per-line draft UI with GitHub-style review threads attached to diff lines.
- Add a reusable review comment data model with threads, comments, authors, draft/submitted state, timestamps, reactions, and attachment placeholders so future PR persistence can map to the same shapes.
- Add a custom Markdown composer using Gitano styles: Write/Preview tabs, textarea editing, Markdown toolbar actions, emoji insertion, reply support, edit/delete support, and a Markdown/files hint row.
- Render comment bodies and previews from stored Markdown instead of plain text.
- Keep all data draft-only in the branch compare modal for now; closing the modal still discards the session state.
- Keep the visual structure GitHub-like while using Gitano's existing dark theme and component styling.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `branch-comparison-review`: Upgrades draft line comments from flat comment boxes to GitHub-style review threads with Markdown composer, preview, emoji insertion, and replies.

## Impact

- Frontend branch comparison modal comment orchestration in `src/features/branches`.
- Diff interaction extension points in `src/features/diffs` may need a full-width thread row so split view can render review threads across both panes.
- New shared review comment UI/model components, likely under `src/features/review-comments`.
- New Markdown rendering dependencies for preview/comment bodies: `react-markdown`, `remark-gfm`, and `rehype-sanitize`.
- Tests for Markdown toolbar transforms, thread/reply lifecycle, draft discard behavior, and unified/split rendering attachment.
