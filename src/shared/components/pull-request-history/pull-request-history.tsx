import {
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import {
  IconBrandGit,
  IconGitPullRequest,
} from "@/shared/components/icons/icons";
import { MarkdownRenderer } from "@/shared/components/markdown-renderer/markdown-renderer";
import type {
  PullRequestComment,
  PullRequestCommit,
  PullRequestListItem,
} from "@/shared/api/integrations";

type PullRequestHistoryProps = {
  pullRequest: PullRequestListItem | null;
  comments: PullRequestComment[];
  commits: PullRequestCommit[];
  loading: boolean;
  error: string | null;
  pendingCommentEdits?: Record<number, string>;
  commentComposer?: ReactNode;
  commentAuthor?: PullRequestListItem["user"];
  scrollTop?: number;
  onScrollTopChange?: (scrollTop: number) => void;
};

type CommentThread = {
  root: PullRequestComment;
  replies: PullRequestComment[];
};

function formatDate(value: string | null | undefined) {
  if (!value) return null;

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return value;

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}

function shortSha(sha: string) {
  return sha.slice(0, 7);
}

function userAvatar(user: PullRequestListItem["user"]) {
  if (user?.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt=""
        className="h-9 w-9 rounded-full border border-border object-cover"
      />
    );
  }

  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background-emphasis text-xs font-semibold text-zinc-300">
      {(user?.login ?? "?").slice(0, 1).toUpperCase()}
    </div>
  );
}

function commentRootId(
  comment: PullRequestComment,
  commentsById: Map<number, PullRequestComment>,
) {
  let parentId = comment.inReplyToId;
  let rootId = comment.id;

  while (parentId !== null) {
    const parent = commentsById.get(parentId);
    if (!parent) break;

    rootId = parent.id;
    parentId = parent.inReplyToId;
  }

  return rootId;
}

function buildCommentThreads(comments: PullRequestComment[]) {
  const sortedComments = [...comments].sort(
    (left, right) =>
      Date.parse(left.createdAt) - Date.parse(right.createdAt) ||
      left.id - right.id,
  );
  const commentsById = new Map(
    sortedComments.map((comment) => [comment.id, comment]),
  );
  const repliesByRoot = new Map<number, PullRequestComment[]>();
  const roots: PullRequestComment[] = [];

  for (const comment of sortedComments) {
    if (comment.inReplyToId === null) {
      roots.push(comment);
      continue;
    }

    const rootId = commentRootId(comment, commentsById);
    if (rootId === comment.id) {
      roots.push(comment);
      continue;
    }

    repliesByRoot.set(rootId, [...(repliesByRoot.get(rootId) ?? []), comment]);
  }

  return roots.map<CommentThread>((root) => ({
    root,
    replies: repliesByRoot.get(root.id) ?? [],
  }));
}

function commentLocation(comment: PullRequestComment) {
  if (!comment.path) return null;
  if (comment.subjectType === "file") return comment.path;

  const line = comment.line ?? comment.originalLine;
  const side = comment.side === "LEFT" ? "L" : comment.side === "RIGHT" ? "R" : "";

  return line ? `${comment.path}:${side}${line}` : comment.path;
}

function CommentBody({
  comment,
  pendingCommentEdits,
}: {
  comment: PullRequestComment;
  pendingCommentEdits: Record<number, string>;
}) {
  const body = pendingCommentEdits[comment.id] ?? comment.body;

  return (
    <div className="space-y-3">
      <MarkdownRenderer markdown={body} />
      {pendingCommentEdits[comment.id] !== undefined ? (
        <div className="text-[11px] font-semibold text-blue-200">
          Draft edit
        </div>
      ) : null}
    </div>
  );
}

function getDiffHunkLineClass(line: string) {
  const baseClass = "block px-4";

  if (line.startsWith("@@")) {
    return `${baseClass} bg-background-emphasis text-zinc-400`;
  }

  if (line.startsWith("+") && !line.startsWith("+++")) {
    return `${baseClass} bg-emerald-950/50 text-emerald-200`;
  }

  if (line.startsWith("-") && !line.startsWith("---")) {
    return `${baseClass} bg-red-950/50 text-red-200`;
  }

  return `${baseClass} text-zinc-300`;
}

function DiffHunkPreview({ diffHunk }: { diffHunk: string }) {
  return (
    <pre
      data-testid="pull-request-diff-hunk"
      className="max-h-44 overflow-auto border-b border-border bg-background py-3 font-mono text-[11px] leading-5"
    >
      {diffHunk.split("\n").map((line, index) => (
        <span key={`${index}-${line}`} className={getDiffHunkLineClass(line)}>
          {line || " "}
        </span>
      ))}
    </pre>
  );
}

function CommentCard({
  thread,
  pendingCommentEdits,
}: {
  thread: CommentThread;
  pendingCommentEdits: Record<number, string>;
}) {
  const { root, replies } = thread;
  const location = commentLocation(root);

  return (
    <div className="grid grid-cols-[44px_minmax(0,1fr)] gap-3">
      <div className="flex justify-center">{userAvatar(root.author)}</div>
      <article className="min-w-0 overflow-hidden rounded border border-border bg-background-emphasis">
        <header className="flex min-w-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <div className="flex min-w-0 items-baseline gap-2">
              <span className="truncate font-semibold text-zinc-100">
                {root.author?.login ?? "Unknown"}
              </span>
              <span className="shrink-0 text-xs text-zinc-500">
                {formatDate(root.createdAt)}
              </span>
            </div>
            {location ? (
              <div className="mt-1 truncate text-[11px] text-zinc-500">
                {location}
              </div>
            ) : null}
          </div>
          <span className="shrink-0 rounded border border-border px-2 py-0.5 text-[10px] font-semibold uppercase text-zinc-400">
            {root.kind === "review" ? "Review" : "Comment"}
          </span>
        </header>
        {root.diffHunk ? (
          <DiffHunkPreview diffHunk={root.diffHunk} />
        ) : null}
        <div className="p-4">
          <CommentBody
            comment={root}
            pendingCommentEdits={pendingCommentEdits}
          />
        </div>
        {replies.length > 0 ? (
          <div className="border-t border-border bg-background/45 px-4 py-3">
            <div className="space-y-3 border-l border-border pl-3">
              {replies.map((reply) => (
                <div
                  key={reply.id}
                  className="rounded border border-border bg-background-emphasis"
                >
                  <div className="flex min-w-0 items-center gap-2 border-b border-border px-3 py-2">
                    {userAvatar(reply.author)}
                    <span className="truncate text-sm font-semibold text-zinc-100">
                      {reply.author?.login ?? "Unknown"}
                    </span>
                    <span className="shrink-0 text-xs text-zinc-500">
                      {formatDate(reply.createdAt)}
                    </span>
                  </div>
                  <div className="p-3">
                    <CommentBody
                      comment={reply}
                      pendingCommentEdits={pendingCommentEdits}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </article>
    </div>
  );
}

export function PullRequestHistory({
  pullRequest,
  comments,
  commits,
  loading,
  error,
  pendingCommentEdits = {},
  commentComposer = null,
  commentAuthor = null,
  onScrollTopChange,
  scrollTop = 0,
}: PullRequestHistoryProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const commentThreads = buildCommentThreads(comments);
  const hasBody = Boolean(pullRequest?.body?.trim());
  const hasHistory =
    Boolean(pullRequest) || commits.length > 0 || commentThreads.length > 0;

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;

    if (!scrollContainer) return;

    scrollContainer.scrollTop = scrollTop;
  }, [commentThreads.length, commits.length, loading, scrollTop]);

  return (
    <div
      ref={scrollContainerRef}
      className="h-full min-h-0 overflow-auto bg-background"
      onScroll={(event) => onScrollTopChange?.(event.currentTarget.scrollTop)}
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-5">
        {loading ? (
          <div className="rounded border border-border bg-background-emphasis px-4 py-3 text-sm text-zinc-300">
            Loading pull request history...
          </div>
        ) : null}
        {error ? (
          <div
            role="alert"
            className="rounded border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-100"
          >
            {error}
          </div>
        ) : null}
        {pullRequest ? (
          <div className="grid grid-cols-[44px_minmax(0,1fr)] gap-3">
            <div className="flex justify-center">
              {userAvatar(pullRequest.user)}
            </div>
            <article className="min-w-0 overflow-hidden rounded border border-blue-500/50 bg-background-emphasis">
              <header className="flex min-w-0 items-center gap-2 border-b border-blue-500/35 px-4 py-3">
                <IconGitPullRequest size={16} className="shrink-0 text-blue-300" />
                <span className="truncate font-semibold text-zinc-100">
                  {pullRequest.user?.login ?? "Unknown"}
                </span>
                <span className="shrink-0 text-sm text-zinc-400">
                  opened this pull request
                </span>
                {formatDate(pullRequest.createdAt) ? (
                  <span className="shrink-0 text-xs text-zinc-500">
                    {formatDate(pullRequest.createdAt)}
                  </span>
                ) : null}
              </header>
              <div className="p-4">
                {hasBody ? (
                  <MarkdownRenderer markdown={pullRequest.body ?? ""} />
                ) : (
                  <div className="text-sm text-zinc-400">No description.</div>
                )}
              </div>
            </article>
          </div>
        ) : null}
        {commits.length > 0 ? (
          <div className="grid grid-cols-[44px_minmax(0,1fr)] gap-3">
            <div className="flex justify-center">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background-emphasis text-zinc-300">
                <IconBrandGit size={15} />
              </div>
            </div>
            <div className="min-w-0 rounded border border-border bg-background-emphasis">
              <div className="border-b border-border px-4 py-2 text-xs font-semibold uppercase text-zinc-500">
                Commits
              </div>
              <div className="divide-y divide-border">
                {commits.map((commit) => (
                  <div
                    key={commit.sha}
                    className="flex min-w-0 items-center justify-between gap-3 px-4 py-3 text-sm"
                  >
                    <span className="min-w-0 truncate text-zinc-200">
                      {commit.messageHeadline || commit.message}
                    </span>
                    <span className="shrink-0 font-mono text-xs text-zinc-500">
                      {shortSha(commit.sha)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
        {commentThreads.map((thread) => (
          <CommentCard
            key={thread.root.id}
            thread={thread}
            pendingCommentEdits={pendingCommentEdits}
          />
        ))}
        {commentComposer ? (
          <div className="grid grid-cols-[44px_minmax(0,1fr)] gap-3">
            <div className="flex justify-center">
              {userAvatar(commentAuthor ?? pullRequest?.user ?? null)}
            </div>
            <section className="min-w-0">
              <h3 className="mb-3 text-lg font-semibold text-foreground">
                Add a comment
              </h3>
              {commentComposer}
            </section>
          </div>
        ) : null}
        {!loading && !error && !hasHistory ? (
          <div className="rounded border border-border bg-background-emphasis px-4 py-3 text-sm text-zinc-400">
            No pull request history.
          </div>
        ) : null}
      </div>
    </div>
  );
}
