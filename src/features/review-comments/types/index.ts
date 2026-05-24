import type { DiffLineAnchor } from "@/features/diffs";

export type ReviewCommentLifecycle = "draft" | "submitted";
export type ReviewThreadStatus = "open" | "resolved";
export type ReviewAuthorKind = "user" | "bot";

export type ReviewCommentAuthor = {
  id: string;
  name: string;
  username?: string;
  avatarUrl?: string;
  initials: string;
  kind: ReviewAuthorKind;
};

export type ReviewReaction = {
  emoji: string;
  count: number;
  reactedByCurrentUser: boolean;
};

export type ReviewAttachment = {
  id: string;
  name: string;
  size?: number;
  mimeType?: string;
  url?: string;
  status: "draft" | "uploaded" | "failed";
};

export type ReviewThreadAnchor = Pick<
  DiffLineAnchor,
  "filePath" | "side" | "oldLine" | "newLine" | "kind"
>;

export type ReviewComment = {
  id: string;
  threadId: string;
  author: ReviewCommentAuthor;
  bodyMarkdown: string;
  createdAt: number;
  updatedAt: number | null;
  lifecycle: ReviewCommentLifecycle;
  reactions: ReviewReaction[];
  attachments: ReviewAttachment[];
};

export type ReviewThread = {
  id: string;
  pairKey: string;
  anchor: ReviewThreadAnchor;
  status: ReviewThreadStatus;
  comments: ReviewComment[];
  attachments: ReviewAttachment[];
  createdAt: number;
  updatedAt: number;
};
