import { useEffect, useRef, useState } from "react";
import {
  IconChevronRight,
  IconDotsVertical,
  IconMessageCircle,
  IconPencil,
  IconX,
} from "@/shared/components/icons/icons";
import { MarkdownComposer } from "../markdown-composer/markdown-composer";
import { MarkdownRenderer } from "../markdown-renderer/markdown-renderer";
import type {
  ReviewComment,
  ReviewCommentAuthor,
  ReviewThread,
} from "../../types/review-comments";

type ReviewThreadViewProps = {
  thread: ReviewThread | null;
  isCreating: boolean;
  currentAuthor: ReviewCommentAuthor;
  onSaveInitial: (bodyMarkdown: string) => void;
  onCancelInitial: () => void;
  onReply: (threadId: string, bodyMarkdown: string) => void;
  onCancelReply?: () => void;
  onResolveThread: (threadId: string, resolved: boolean) => void;
  onUpdateComment: (
    commentId: string,
    bodyMarkdown: string,
  ) => void | Promise<void>;
  onDeleteComment: (commentId: string) => void;
  defaultCollapsed?: boolean;
  replyInitiallyOpen?: boolean;
  allowSubmittedCommentEditing?: boolean;
  title?: string;
};

export function ReviewThreadView({
  thread,
  isCreating,
  currentAuthor,
  onSaveInitial,
  onCancelInitial,
  onReply,
  onCancelReply,
  onResolveThread,
  onUpdateComment,
  onDeleteComment,
  defaultCollapsed = false,
  replyInitiallyOpen = false,
  allowSubmittedCommentEditing = false,
  title = "Review thread",
}: ReviewThreadViewProps) {
  const [replying, setReplying] = useState(false);
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const previousThreadId = useRef<string | null>(thread?.id ?? null);

  useEffect(() => {
    const threadId = thread?.id ?? null;
    if (previousThreadId.current !== threadId) {
      previousThreadId.current = threadId;
      setCollapsed(defaultCollapsed);
    }
  }, [defaultCollapsed, thread?.id]);

  useEffect(() => {
    if (thread && replyInitiallyOpen) {
      setCollapsed(false);
      setReplying(true);
    }
  }, [replyInitiallyOpen, thread?.id]);

  useEffect(() => {
    if (thread?.status === "resolved") {
      setCollapsed(true);
      setReplying(false);
    }
  }, [thread?.status]);

  if (!thread && !isCreating) return null;

  return (
    <div className="mx-auto w-full max-w-5xl overflow-hidden rounded border border-border bg-background shadow-lg">
      {thread ? (
        <div className="flex h-9 w-full items-center justify-between gap-3 border-b border-border bg-background-emphasis px-3 text-sm text-zinc-200">
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-2 text-left transition-colors hover:text-zinc-100"
            onClick={() => setCollapsed((current) => !current)}
            aria-expanded={!collapsed}
          >
            <IconChevronRight
              size={15}
              className={`shrink-0 transition-transform ${
                collapsed ? "" : "rotate-90"
              }`}
            />
            <IconMessageCircle size={15} className="shrink-0 text-zinc-400" />
            <span className="truncate font-medium">{title}</span>
          </button>
          <div className="flex shrink-0 items-center gap-2">
            {thread.status === "resolved" ? (
              <span className="shrink-0 rounded border border-lime-500/40 bg-lime-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-lime-100">
                Resolved
              </span>
            ) : null}
            <span className="text-xs text-zinc-500">{thread.comments.length}</span>
          </div>
        </div>
      ) : null}

      {!collapsed
        ? renderThreadComments({
            comments: thread?.comments ?? [],
            allowSubmittedCommentEditing,
            onUpdateComment,
            onDeleteComment,
          })
        : null}

      {thread && !collapsed ? (
        <div className="border-t border-border bg-background-emphasis p-3">
          {replying ? (
            <ComposerState
              autoFocus
              saveLabel="Reply"
              placeholder="Reply..."
              onCancel={() => {
                setReplying(false);
                onCancelReply?.();
              }}
              onSave={(bodyMarkdown) => {
                onReply(thread.id, bodyMarkdown);
                setReplying(false);
                onCancelReply?.();
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
              onClick={() => {
                const nextResolved = thread.status !== "resolved";
                onResolveThread(thread.id, nextResolved);
                if (nextResolved) {
                  setCollapsed(true);
                  setReplying(false);
                }
              }}
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

function renderThreadComments({
  comments,
  allowSubmittedCommentEditing,
  onUpdateComment,
  onDeleteComment,
}: {
  comments: ReviewComment[];
  allowSubmittedCommentEditing: boolean;
  onUpdateComment: (
    commentId: string,
    bodyMarkdown: string,
  ) => void | Promise<void>;
  onDeleteComment: (commentId: string) => void;
}) {
  const commentIds = new Set(comments.map((comment) => comment.id));
  const rootComments = comments.filter(
    (comment) =>
      !comment.parentCommentId || !commentIds.has(comment.parentCommentId),
  );

  return rootComments.map((comment) => {
    const replies = comments.filter(
      (reply) => reply.parentCommentId === comment.id,
    );

    return (
      <div key={comment.id} className="border-b border-border last:border-b-0">
        <ReviewCommentCard
          comment={comment}
          allowSubmittedCommentEditing={allowSubmittedCommentEditing}
          onUpdateComment={onUpdateComment}
          onDeleteComment={onDeleteComment}
        />
        {replies.length > 0 ? (
          <div className="border-t border-border bg-background/60 py-2 pl-8 pr-3">
            <div className="space-y-2 border-l border-border pl-4">
              {replies.map((reply) => (
                <ReviewCommentCard
                  key={reply.id}
                  comment={reply}
                  nested
                  allowSubmittedCommentEditing={allowSubmittedCommentEditing}
                  onUpdateComment={onUpdateComment}
                  onDeleteComment={onDeleteComment}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    );
  });
}

function ReviewCommentCard({
  comment,
  nested = false,
  allowSubmittedCommentEditing,
  onUpdateComment,
  onDeleteComment,
}: {
  comment: ReviewComment;
  nested?: boolean;
  allowSubmittedCommentEditing: boolean;
  onUpdateComment: (
    commentId: string,
    bodyMarkdown: string,
  ) => void | Promise<void>;
  onDeleteComment: (commentId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const canEdit =
    comment.lifecycle === "draft" ||
    (allowSubmittedCommentEditing && comment.lifecycle === "submitted");
  const canDelete = comment.lifecycle === "draft";

  if (editing) {
    return (
      <div className="border-b border-border p-3 last:border-b-0">
        <ComposerState
          autoFocus
          initialValue={comment.bodyMarkdown}
          saveLabel={saving ? "Saving" : "Save"}
          placeholder="Edit comment"
          onCancel={() => setEditing(false)}
          onSave={async (bodyMarkdown) => {
            setSaving(true);
            try {
              await onUpdateComment(comment.id, bodyMarkdown);
              setEditing(false);
            } finally {
              setSaving(false);
            }
          }}
        />
      </div>
    );
  }

  return (
    <article className={nested ? "overflow-hidden rounded border border-border" : ""}>
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
          {canEdit || canDelete ? (
            <>
              {canEdit ? (
                <button
                  type="button"
                  className="rounded p-1 text-muted-foreground transition-colors hover:bg-zinc-800 hover:text-foreground"
                  onClick={() => setEditing(true)}
                  aria-label="Edit comment"
                >
                  <IconPencil size={15} />
                </button>
              ) : null}
              {canDelete ? (
                <button
                  type="button"
                  className="rounded p-1 text-muted-foreground transition-colors hover:bg-zinc-800 hover:text-red-200"
                  onClick={() => onDeleteComment(comment.id)}
                  aria-label="Delete comment"
                >
                  <IconX size={15} />
                </button>
              ) : null}
            </>
          ) : null}
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
  onSave: (bodyMarkdown: string) => void | Promise<void>;
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
  if (comment.pendingOperation === "edit") return "draft edit";
  if (comment.updatedAt) return "edited just now";
  if (comment.lifecycle === "draft") return "draft";
  return new Date(comment.createdAt).toLocaleDateString();
}
