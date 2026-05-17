## 1. Dependencies And Review Comment Model

- [x] 1.1 Add Markdown rendering dependencies for `react-markdown`, `remark-gfm`, and `rehype-sanitize`.
- [x] 1.2 Create reusable review comment types for authors, threads, comments, reactions, attachments, and lifecycle state.
- [x] 1.3 Add reducer/helper functions for creating threads, adding replies, updating comments, deleting comments, and finding threads by diff line anchor.
- [x] 1.4 Add focused unit tests for review thread lifecycle helpers.

## 2. Markdown Composer And Renderer

- [x] 2.1 Create Markdown transform utilities for heading, bold, italic, quote, inline code, code block, link, ordered list, bullet list, task list, mention insertion, and emoji insertion.
- [x] 2.2 Add unit tests for toolbar transforms, including selected text and multi-line selections.
- [x] 2.3 Create a Markdown renderer component using `react-markdown`, `remark-gfm`, and `rehype-sanitize`.
- [x] 2.4 Create a GitHub-style Markdown composer with Write/Preview tabs, textarea, toolbar buttons, emoji menu, Markdown/file hint row, and save/cancel controls.
- [x] 2.5 Ensure composer UI uses Gitano styles and does not introduce GitHub color theming.

## 3. Review Thread UI

- [x] 3.1 Create a review thread component that renders comment cards, metadata, edit/delete actions, reply composer, and empty draft composer state.
- [x] 3.2 Support editing existing draft comments with the same Markdown composer and non-empty validation.
- [x] 3.3 Support deleting comments and removing empty threads.
- [x] 3.4 Add interaction or component tests for add, reply, edit, delete, preview, and emoji insertion flows.

## 4. Diff Integration

- [x] 4.1 Extend the diff interaction provider with a generic full-width line-below extension slot.
- [x] 4.2 Render full-width extension rows in unified and split diff modes without breaking staging gutters.
- [x] 4.3 Replace branch comparison flat comment state with review thread state and actions.
- [x] 4.4 Wire branch comparison diff line accessories to create/open review threads.
- [x] 4.5 Preserve thread attachment across unified/split display mode switches and file changes.
- [x] 4.6 Discard all review thread state when the branch comparison modal closes.

## 5. Verification

- [x] 5.1 Validate the OpenSpec change.
- [x] 5.2 Run the focused review comment and branch comparison tests.
- [x] 5.3 Run the full frontend test suite.
- [x] 5.4 Run lint.
- [x] 5.5 Run the frontend build.
