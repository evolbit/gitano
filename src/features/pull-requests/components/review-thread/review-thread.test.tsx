import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReviewThreadView } from "./review-thread";
import type {
  ReviewCommentAuthor,
  ReviewThread,
} from "../../types/review-comments";

const author: ReviewCommentAuthor = {
  id: "current-user",
  name: "Current User",
  initials: "CU",
  kind: "user",
};

const thread: ReviewThread = {
  id: "thread-1",
  pairKey: "main...feature",
  anchor: {
    filePath: "src/file.ts",
    side: "new",
    oldLine: null,
    newLine: 12,
    kind: "Add",
  },
  status: "open",
  comments: [
    {
      id: "comment-1",
      threadId: "thread-1",
      parentCommentId: null,
      author,
      bodyMarkdown: "**First**",
      createdAt: 123,
      updatedAt: null,
      lifecycle: "draft",
      reactions: [],
      attachments: [],
    },
  ],
  attachments: [],
  createdAt: 123,
  updatedAt: 123,
};

describe("ReviewThreadView", () => {
  afterEach(() => {
    cleanup();
  });

  it("saves an initial comment from the composer", async () => {
    const user = userEvent.setup();
    const onSaveInitial = vi.fn();

    render(
      <ReviewThreadView
        thread={null}
        isCreating
        currentAuthor={author}
        onSaveInitial={onSaveInitial}
        onCancelInitial={vi.fn()}
        onReply={vi.fn()}
        onResolveThread={vi.fn()}
        onUpdateComment={vi.fn()}
        onDeleteComment={vi.fn()}
      />,
    );

    await user.type(screen.getByPlaceholderText("Leave a comment"), "Hello");
    await user.click(screen.getByRole("button", { name: "Comment" }));

    expect(onSaveInitial).toHaveBeenCalledWith("Hello");
  });

  it("supports replies, editing, deleting, preview, and emoji insertion", async () => {
    const user = userEvent.setup();
    const onReply = vi.fn();
    const onResolveThread = vi.fn();
    const onUpdateComment = vi.fn();
    const onDeleteComment = vi.fn();

    render(
      <ReviewThreadView
        thread={thread}
        isCreating={false}
        currentAuthor={author}
        onSaveInitial={vi.fn()}
        onCancelInitial={vi.fn()}
        onReply={onReply}
        onResolveThread={onResolveThread}
        onUpdateComment={onUpdateComment}
        onDeleteComment={onDeleteComment}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Reply..." }));
    await user.type(screen.getByPlaceholderText("Reply..."), "LGTM");
    await user.click(screen.getByRole("button", { name: "Emoji" }));
    await user.click(screen.getByRole("button", { name: "✅" }));
    await user.click(screen.getByRole("button", { name: "Preview" }));

    expect(screen.getByText("LGTM✅")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Write" }));
    await user.click(screen.getByRole("button", { name: "Reply" }));

    expect(onReply).toHaveBeenCalledWith("thread-1", "LGTM✅");

    await user.click(screen.getByRole("button", { name: "Edit comment" }));
    const editTextarea = screen.getByPlaceholderText("Edit comment");
    fireEvent.change(editTextarea, { target: { value: "Updated" } });
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onUpdateComment).toHaveBeenCalledWith("comment-1", "Updated");

    await user.click(screen.getByRole("button", { name: "Delete comment" }));

    expect(onDeleteComment).toHaveBeenCalledWith("comment-1");

    await user.click(screen.getByRole("button", { name: "Resolve conversation" }));

    expect(onResolveThread).toHaveBeenCalledWith("thread-1", true);
  });

  it("collapses resolved threads and reopens from inside the thread", async () => {
    const user = userEvent.setup();
    const onResolveThread = vi.fn();
    const resolvedThread: ReviewThread = {
      ...thread,
      status: "resolved",
      comments: [
        {
          ...thread.comments[0],
          bodyMarkdown: "Resolved body",
        },
      ],
    };

    render(
      <ReviewThreadView
        thread={resolvedThread}
        isCreating={false}
        currentAuthor={author}
        onSaveInitial={vi.fn()}
        onCancelInitial={vi.fn()}
        onReply={vi.fn()}
        onResolveThread={onResolveThread}
        onUpdateComment={vi.fn()}
        onDeleteComment={vi.fn()}
      />,
    );

    expect(screen.getByText("Resolved")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText("Resolved body")).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Review thread" }));
    await user.click(screen.getByRole("button", { name: "Reopen conversation" }));

    expect(onResolveThread).toHaveBeenCalledWith("thread-1", false);
  });
});
