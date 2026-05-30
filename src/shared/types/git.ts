export interface CommitGraphSegment {
  color_idx: number;
  from_lane: number;
  from_y: number;
  to_lane: number;
  to_y: number;
  control_lane?: number | null;
  control_y?: number | null;
}

export type RepositoryHeadStatus = "normal" | "unborn" | "detached" | "unknown";

export interface RepositoryState {
  path: string;
  isValid: boolean;
  branch: string | null;
  headStatus: RepositoryHeadStatus;
  hasCommits: boolean;
  isUnborn: boolean;
  isDetached: boolean;
}

export interface CommitListItem {
  sha: string;
  parents?: string[];
  graph_width?: number;
  graph_lane?: number;
  graph_color?: number;
  graph_segments?: CommitGraphSegment[];
  refs?: string[];
  message: string;
  author: string;
  author_initial: string;
  author_avatar_url?: string | null;
  date: number;
  current_branch: string;
  source_branch: string;
  commit_history: string[];
  files: number;
}

export type CommitHistoryMode = "git_log" | "first_parent";

export interface CommitListPage {
  commits: CommitListItem[];
  has_more: boolean;
}

export type CommitHistoryCacheStatus = "idle" | "loading" | "ready" | "error";

export interface CommitHistoryStatusResponse {
  status: CommitHistoryCacheStatus;
  totalCount: number;
  error: string | null;
}

export interface CommitHistoryWindow {
  commits: CommitListItem[];
  offset: number;
  limit: number;
  totalCount: number;
  hasPrevious: boolean;
  hasMore: boolean;
}

export interface CommitGraphRow {
  rowIndex: number;
  graphWidth: number;
  graphLane: number;
  graphColor: number;
  graphSegments: CommitGraphSegment[];
  refs: string[];
}

export interface CommitGraphWindow {
  rows: CommitGraphRow[];
  offset: number;
  limit: number;
  totalCount: number;
}

export type CommitSearchDirection = "next" | "previous";

export interface CommitHistorySearchResponse {
  query: string;
  matchCount: number;
  currentMatchPosition: number | null;
  matchedRowIndex: number | null;
  matchedSha: string | null;
}

export interface TagCommitOption {
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  date: number;
}

export type GitPushMode = "push-branch" | "push-branch-and-tags";
export type GitFetchMode = "fetch-all" | "fetch-all-prune";

export type TagRefStatus =
  | "local-origin"
  | "local"
  | "origin"
  | "conflict"
  | "unknown";

export type BranchRefPresence = "local-origin" | "local" | "origin";

export interface GitBranchRef {
  name: string;
  localName: string | null;
  originName: string | null;
  localTargetId: string | null;
  originTargetId: string | null;
  upstreamName: string | null;
  presence: BranchRefPresence;
  aheadCount: number | null;
  behindCount: number | null;
}

export interface GitTagRef {
  name: string;
  localObjectId: string | null;
  originObjectId: string | null;
  localTargetId: string | null;
  originTargetId: string | null;
  status: TagRefStatus;
  isLocalAnnotated: boolean;
}

export interface GitTagRefsResponse {
  tags: GitTagRef[];
  originAvailable: boolean;
  originError: string | null;
}

export interface TagNameAvailability {
  validName: boolean;
  localExists: boolean;
  originExists: boolean | null;
  originAvailable: boolean;
  originError: string | null;
}

export enum ChangeType {
  Added = "added",
  Deleted = "deleted",
  Modified = "modified",
  Renamed = "renamed",
  Copied = "copied",
  TypeChanged = "typeChanged",
}

export interface FileChange {
  path: string;
  status:
    | "added"
    | "deleted"
    | "modified"
    | "renamed"
    | "copied"
    | "typeChanged";
  insertions: number;
  deletions: number;
}

export interface WorkingChangeFileSummary extends FileChange {
  isUntracked: boolean;
  fileSignature: string;
}

export interface CommitDiff {
  commitSha: string;
  changes: FileChange[];
}

export interface FileChangeWithHunks extends FileChange {
  hunks: DiffHunk[];
}

export interface StagedFileSelectionState {
  isNewFile?: boolean;
  isWholeFileStaged?: boolean;
  isPartiallyStaged?: boolean;
  hunks: Record<number, number[]>;
}

export interface WorkingDirectoryChangesResponse {
  changes: FileChangeWithHunks[];
  staged_state_by_file: Record<string, StagedFileSelectionState>;
}

export interface WorkingDirectorySummaryResponse {
  changes: WorkingChangeFileSummary[];
  staged_state_by_file: Record<string, StagedFileSelectionState>;
}

export interface WorkingFileDetailResponse {
  file: FileChangeWithHunks;
  stagedState?: StagedFileSelectionState | null;
  fileSignature: string;
}

export interface GitStashEntry {
  selector: string;
  hash: string;
  message: string;
  date: number;
}

export interface GitWorktree {
  path: string;
  name: string;
  branch: string | null;
  head: string | null;
  isCurrent: boolean;
  isMain: boolean;
  isBare: boolean;
  isDetached: boolean;
}

export interface StashFileChange {
  path: string;
  status:
    | "added"
    | "deleted"
    | "modified"
    | "renamed"
    | "copied"
    | "typeChanged"
    | "typechanged";
  insertions: number;
  deletions: number;
}

export interface DiffLine {
  kind: "Add" | "Del" | "Context";
  content: string;
  old_lineno: number | null;
  new_lineno: number | null;
}

export interface DiffHunk {
  header: string;
  old_start: number;
  old_lines: number;
  new_start: number;
  new_lines: number;
  lines: DiffLine[];
  is_new_file: boolean;
}
