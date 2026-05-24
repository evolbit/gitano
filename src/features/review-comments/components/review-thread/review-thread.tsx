import { useEffect, useState } from "react";
import { IconDotsVertical, IconPencil, IconX } from "@/shared/components/icons/icons";
import { MarkdownComposer } from "../markdown-composer/markdown-composer";
import { MarkdownRenderer } from "../markdown-renderer/markdown-renderer";
import type { ReviewComment, ReviewCommentAuthor, ReviewThread } from "../../types";

type ReviewThreadViewProps = {
  thread: ReviewThread | null;
  isCreating: boolean;
  currentAuthor: ReviewCommentAuthor;
  onSaveInitial: (bodyMarkdown: string) => void;
  onCancelInitial: () => void;
  onReply: (threadId: string, bodyMarkdown: string) => void;
  onResolveThread: (threadId: string, resolved: boolean) => void;
  onUpdateComment: (commentId: string, bodyMarkdown: string) => void;
  onDeleteComment: (commentId: string) => void;
};

export function ReviewThreadView({
  thread,
  isCreating,
  currentAuthor,
  onSaveInitial,
  onCancelInitial,
  onReply,
  onResolveThread,
  onUpdateComment,
  onDeleteComment,
}: ReviewThreadViewProps) {
  const [replying, setReplying] = useState(false);

  if (!thread && !isCreating) return null;

  return (
    <div className="mx-auto w-full max-w-5xl overflow-hidden rounded border border-border bg-background shadow-lg">
      {thread?.comments.map((comment) => (
        <ReviewCommentCard
          key={comment.id}
          comment={comment}
          onUpdateComment={onUpdateComment}
          onDeleteComment={onDeleteComment}
        />
      ))}

      {thread ? (
        <div className="border-t border-border bg-background-emphasis p-3">
          {replying ? (
            <ComposerState
              autoFocus
              saveLabel="Reply"
              placeholder="Reply..."
              onCancel={() => setReplying(false)}
              onSave={(bodyMarkdown) => {
                onReply(thread.id, bodyMarkdown);
                setReplying(false);
              }}
            />
          ) : (
            <button
              type="button"
              className="flex h-9 w-full items-center rounded border border-border bg-background px-3 text-left text-sm text-muted-foreground transition-colors hover:border-zinc-600 hover:text-foreground"
              onClick={() => setReplying(true)}
            >
              Reply...
            </button>
          )}
          <div className="mt-3">
            <button
              type="button"
              className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-zinc-800"
              onClick={() => onResolveThread(thread.id, thread.status !== "resolved")}
            >
              {thread.status === "resolved"
                ? "Reopen conversation"
                : "Resolve conversation"}
            </button>
          </div>
        </div>
      ) : null}

      {isCreating && !thread ? (
        <div className="border-t border-border bg-background-emphasis p-3">
          <div className="mb-2 flex items-center gap-2">
            <AuthorAvatar author={currentAuthor} />
            <span className="text-sm font-medium text-foreground">
              {currentAuthor.name}
            </span>
          </div>
          <ComposerState
            autoFocus
            saveLabel="Comment"
            placeholder="Leave a comment"
            onSave={onSaveInitial}
            onCancel={onCancelInitial}
          />
        </div>
      ) : null}
    </div>
  );
}

function ReviewCommentCard({
  comment,
  onUpdateComment,
  onDeleteComment,
}: {
  comment: ReviewComment;
  onUpdateComment: (commentId: string, bodyMarkdown: string) => void;
  onDeleteComment: (commentId: string) => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className="border-b border-border p-3 last:border-b-0">
        <ComposerState
          autoFocus
          initialValue={comment.bodyMarkdown}
          saveLabel="Save"
          placeholder="Edit comment"
          onCancel={() => setEditing(false)}
          onSave={(bodyMarkdown) => {
            onUpdateComment(comment.id, bodyMarkdown);
            setEditing(false);
          }}
        />
      </div>
    );
  }

  return (
    <article className="border-b border-border last:border-b-0">
      <header className="flex items-center justify-between gap-3 border-b border-border bg-background-emphasis px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <AuthorAvatar author={comment.author} />
          <span className="truncate text-sm font-semibold text-foreground">
            {comment.author.name}
          </span>
          {comment.author.kind === "bot" ? (
            <span className="rounded border border-border px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
              bot
            </span>
          ) : null}
          <span className="text-xs text-muted-foreground">
            {formatCommentTime(comment)}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-zinc-800 hover:text-foreground"
            aria-label="More comment actions"
          >
            <IconDotsVertical size={15} />
          </button>
          <button
            type="button"
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-zinc-800 hover:text-foreground"
            onClick={() => setEditing(true)}
            aria-label="Edit comment"
          >
            <IconPencil size={15} />
          </button>
          <button
            type="button"
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-zinc-800 hover:text-red-200"
            onClick={() => onDeleteComment(comment.id)}
            aria-label="Delete comment"
          >
            <IconX size={15} />
          </button>
        </div>
      </header>
      <div className="px-3 py-3">
        <MarkdownRenderer markdown={comment.bodyMarkdown} />
      </div>
    </article>
  );
}

function ComposerState({
  initialValue = "",
  saveLabel,
  placeholder,
  autoFocus = false,
  onSave,
  onCancel,
}: {
  initialValue?: string;
  saveLabel: string;
  placeholder: string;
  autoFocus?: boolean;
  onSave: (bodyMarkdown: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  return (
    <MarkdownComposer
      value={value}
      onChange={setValue}
      onSave={() => onSave(value.trim())}
      onCancel={onCancel}
      saveLabel={saveLabel}
      placeholder={placeholder}
      autoFocus={autoFocus}
    />
  );
}

function AuthorAvatar({ author }: { author: ReviewCommentAuthor }) {
  if (author.avatarUrl) {
    return (
      <img
        src={author.avatarUrl}
        alt=""
        className="h-7 w-7 rounded-full border border-border"
      />
    );
  }

  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-background text-xs font-semibold text-muted-foreground">
      {author.initials}
    </span>
  );
}

function formatCommentTime(comment: ReviewComment) {
  if (comment.updatedAt) return "edited just now";
  if (comment.lifecycle === "draft") return "draft";
  return new Date(comment.createdAt).toLocaleDateString();
}
