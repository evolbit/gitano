## Context

The branch comparison modal already supports draft line comments through the diff interaction provider, but the UI is a narrow plain text box rendered below a diff line. The user wants the GitHub review-comment format and feature set: threaded cards, replies, Write/Preview Markdown composer tabs, toolbar-assisted Markdown formatting, emoji insertion, and future-friendly data modeling. Comments remain draft-only and modal-session scoped for this change.

The project uses Mantine packages, but `@mantine/tiptap` is not installed and would move comment bodies toward rich text or HTML. GitHub review comments are Markdown-source-first, so this design keeps Markdown as the canonical body format and builds the composer UI directly with Gitano styles.

## Goals / Non-Goals

**Goals:**
- Render diff line comments as GitHub-style review threads with cards and reply composers.
- Store comment text as `bodyMarkdown` and render it through a Markdown viewer.
- Provide Write and Preview modes for composing and editing.
- Provide toolbar actions that transform textarea selections into Markdown syntax.
- Support emoji insertion at the textarea cursor.
- Support replies, editing, deleting, and draft-only session discard.
- Model data for future PR persistence, including thread ids, comment ids, author metadata, timestamps, draft/submitted state, reactions, and attachment placeholders.
- Keep the UI themed with Gitano styles rather than GitHub colors.

**Non-Goals:**
- Persisting review threads outside the modal session.
- Creating a full WYSIWYG rich text editor.
- Implementing attachment upload/storage.
- Implementing remote mentions, user search, or PR submission.
- Adding full GitHub markdown parity beyond the support provided by `remark-gfm`.

## Decisions

### Keep Markdown as the canonical comment body

Review comment bodies will be stored as Markdown strings (`bodyMarkdown`). Preview and displayed comments will render Markdown using `react-markdown` with `remark-gfm` and `rehype-sanitize`.

Alternative considered: `@mantine/tiptap` / Tiptap rich text. It fits Mantine styling, but it introduces editor state and HTML/Markdown conversion decisions that are unnecessary for a GitHub-style comment composer.

### Build a custom textarea composer

The composer will use a controlled textarea with toolbar buttons that apply Markdown transforms to the selected text. This provides the GitHub Write/Preview workflow while keeping styling and layout fully under Gitano control.

Toolbar actions should include at least heading, bold, italic, quote, inline code, link, ordered list, unordered list, task list, attachment placeholder, mention placeholder, emoji insertion, undo, and clear/expand-style affordances where useful.

### Extract review comment UI into a reusable feature module

Create a `src/features/review-comments` module for review-thread types, reducer helpers, Markdown transforms, Markdown renderer, composer, thread card, and tests. The branch comparison modal should only coordinate active comparison state and pass thread operations through the diff interaction provider.

This keeps future PR review integration from being tied to `src/features/branches`.

### Add a full-width diff extension row

The current line extension point renders inside one line/cell. That is too narrow for a thread in split view. The diff base renderer should allow a thread row to span the full diff width below the affected diff line/row. The extension remains generic: the diff renderer supplies anchors and a placement slot, but it does not know about review comments.

### Model threads, not flat comments

Review state should be keyed by comparison pair and line anchor:
- `ReviewThread` owns the line anchor, resolution state, comments, and attachment placeholders.
- `ReviewComment` owns author metadata, Markdown body, timestamps, draft/submitted state, reactions, and edit state derived by UI.
- Replies append comments to the thread.

For this change, all comments can use a local current-user/system author and draft state, but the shape should be compatible with future provider-backed PR comments.

## Risks / Trade-offs

- [Markdown rendering can introduce unsafe HTML] -> Use `rehype-sanitize` and avoid enabling raw HTML rendering.
- [Toolbar transforms can behave unexpectedly with multi-line selections] -> Keep transforms deterministic and add focused unit tests.
- [Thread UI could make split diff rows too tall or cramped] -> Render threads in a full-width row spanning split panes.
- [Emoji picker dependencies can add bundle weight] -> Start with a small built-in emoji menu or lazy-load an external picker later; keep insertion API independent of the picker implementation.
- [React context updates can rerender many diff rows] -> Keep thread lookup maps memoized and provider callbacks stable.

## Migration Plan

1. Add Markdown rendering dependencies and reusable review comment model/UI.
2. Extend diff renderer slots for full-width thread rows.
3. Replace branch comparison flat comments with thread state and review thread rendering.
4. Add focused tests for Markdown transforms, thread lifecycle, and API-free draft discard behavior.
5. Verify existing branch comparison, unified/split diff display, and working-tree staging behavior remain intact.

Rollback is straightforward because the change is frontend-only and draft-only: restore the flat comment UI and remove the new review comment module/dependencies if needed.

## Open Questions

- Attachment upload UI is represented as a placeholder only for this change. The future persistence layer will need to define upload destination, file ids, and markdown insertion behavior.
