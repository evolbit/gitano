import ReactDOM from "react-dom";
import type { RefObject } from "react";
import type { CommitListItem } from "@/shared/types/git";

export type CommitContextMenuAction =
  | "copySha"
  | "copyMessage"
  | "copyPatch"
  | "compareWithParent"
  | "compareWithWorkingTree"
  | "createBranch"
  | "createTag"
  | "createWorktree"
  | "cherryPick"
  | "revert"
  | "openRemote"
  | "copyRemoteUrl";

type CommitContextMenuProps = {
  commit: CommitListItem;
  x: number;
  y: number;
  menuRef: RefObject<HTMLDivElement>;
  remoteCommitUrl: string | null;
  currentBranch?: string | null;
  onAction: (action: CommitContextMenuAction) => void;
};

const sectionTitleClass =
  "px-4 pt-2 pb-1 text-[9px] font-semibold uppercase tracking-wide text-zinc-500";
const itemClass = "cursor-pointer px-4 py-2 hover:bg-zinc-700";
const disabledItemClass = "cursor-not-allowed px-4 py-2 text-zinc-500";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className={sectionTitleClass}>{children}</div>;
}

function Separator() {
  return <div className="my-1 border-t border-zinc-700" />;
}

function MenuItem({
  children,
  disabled,
  title,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  title?: string;
  onClick: () => void;
}) {
  return (
    <div
      className={disabled ? disabledItemClass : itemClass}
      title={title}
      onClick={() => {
        if (!disabled) onClick();
      }}
    >
      {children}
    </div>
  );
}

export function CommitContextMenu({
  commit,
  x,
  y,
  menuRef,
  remoteCommitUrl,
  currentBranch,
  onAction,
}: CommitContextMenuProps) {
  const applyDisabledReason = currentBranch
    ? null
    : "A current branch is required for this operation";

  return ReactDOM.createPortal(
    <div
      ref={menuRef}
      style={{
        position: "fixed",
        top: y,
        left: x,
        zIndex: 99999,
      }}
      className="z-[99999] min-w-[280px] select-none rounded border border-border bg-background-emphasis py-1 text-xs text-zinc-200 shadow-lg"
    >
      <SectionTitle>Commit</SectionTitle>
      <MenuItem onClick={() => onAction("copySha")}>Copy commit SHA</MenuItem>
      <MenuItem onClick={() => onAction("copyMessage")}>
        Copy commit message
      </MenuItem>
      <MenuItem onClick={() => onAction("copyPatch")}>Copy patch</MenuItem>

      <Separator />
      <SectionTitle>Compare</SectionTitle>
      <MenuItem onClick={() => onAction("compareWithParent")}>
        Compare with parent...
      </MenuItem>
      <MenuItem onClick={() => onAction("compareWithWorkingTree")}>
        Compare with working tree...
      </MenuItem>

      <Separator />
      <SectionTitle>Create From Commit</SectionTitle>
      <MenuItem onClick={() => onAction("createBranch")}>
        Create branch from commit...
      </MenuItem>
      <MenuItem onClick={() => onAction("createTag")}>
        Create tag at commit...
      </MenuItem>
      <MenuItem onClick={() => onAction("createWorktree")}>
        Create worktree from commit...
      </MenuItem>

      <Separator />
      <SectionTitle>Apply To Current Branch</SectionTitle>
      <MenuItem
        disabled={Boolean(applyDisabledReason)}
        title={applyDisabledReason ?? undefined}
        onClick={() => onAction("cherryPick")}
      >
        Cherry-pick commit...
      </MenuItem>
      <MenuItem
        disabled={Boolean(applyDisabledReason)}
        title={applyDisabledReason ?? undefined}
        onClick={() => onAction("revert")}
      >
        Revert commit...
      </MenuItem>

      {remoteCommitUrl ? (
        <>
          <Separator />
          <SectionTitle>Remote</SectionTitle>
          <MenuItem onClick={() => onAction("openRemote")}>
            Open commit on remote
          </MenuItem>
          <MenuItem onClick={() => onAction("copyRemoteUrl")}>
            Copy commit URL
          </MenuItem>
        </>
      ) : null}

      <div className="sr-only">{commit.sha}</div>
    </div>,
    document.body,
  );
}
