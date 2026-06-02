import ReactDOM from "react-dom";
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { GitBranchRef } from "@/shared/types/git";
import { BranchContextMenuBranchingItems } from "../branch-context-menu-branching-items/branch-context-menu-branching-items";
import { BranchContextMenuBranchOperations } from "../branch-context-menu-branch-operations/branch-context-menu-branch-operations";
import { BranchContextMenuCompareItems } from "../branch-context-menu-compare-items/branch-context-menu-compare-items";
import { BranchContextMenuDangerZone } from "../branch-context-menu-danger-zone/branch-context-menu-danger-zone";
import { BranchContextMenuOtherActions } from "../branch-context-menu-other-actions/branch-context-menu-other-actions";
import { BranchContextMenuPullRequestActions } from "../branch-context-menu-pull-request-actions/branch-context-menu-pull-request-actions";
import { BranchContextMenuRemoteBranchOperations } from "../branch-context-menu-remote-branch-operations/branch-context-menu-remote-branch-operations";
import { BranchContextMenuRemoteActions } from "../branch-context-menu-remote-actions/branch-context-menu-remote-actions";
import { BranchContextMenuSeparator } from "../branch-context-menu-parts/branch-context-menu-parts";
import { BranchContextMenuWorktreeActions } from "../branch-context-menu-worktree-actions/branch-context-menu-worktree-actions";
import type {
  BranchType,
  BranchContextMenuState,
  BranchOperationCommand,
  MatchingBranchPullRequest,
  MenuPosition,
  PendingRemoteBranchAction,
  RemoteBranchActionCommand,
  RemoteBranchOperationCommand,
  BranchComparisonSelection,
} from "../../types";

type BranchContextMenuProps = {
  contextMenu: BranchContextMenuState | null;
  menuPos: MenuPosition | null;
  menuRef: RefObject<HTMLDivElement>;
  selectedBranch?: string | null;
  branchRefByName: Map<string, GitBranchRef>;
  branchType: BranchType;
  creatingWorktree: boolean;
  matchingPullRequestByHead: Map<string, MatchingBranchPullRequest>;
  remoteUrl: string | null;
  onCloseContextMenu: () => void;
  onBeginCreateBranch: (baseRef: string, prefix?: string) => void;
  onCheckoutBranch: (branchName: string) => void;
  onRunBranchOperation: (
    command: BranchOperationCommand,
    targetBranch: string,
    successTitle: string,
    successDetails: string,
    failureTitle: string,
    selectedRowAfter: string | null,
  ) => void;
  onRunRemoteBranchOperation: (
    command: RemoteBranchOperationCommand,
    branchName: string,
    successTitle: string,
    successDetails: string,
    failureTitle: string,
  ) => void;
  onRunRemoteBranchAction: (
    command: RemoteBranchActionCommand,
    branchName: string,
    pendingAction: PendingRemoteBranchAction,
    successTitle: string,
    successDetails: string,
    failureTitle: string,
  ) => void;
  onCreateRandomWorktreeFromBranch: (baseRef: string) => void;
  onCopyText: (text: string, successTitle: string, successDetails: string) => void;
  onCopyBranchTipSha: (branchName: string) => void;
  onCopyRemoteBranchUrl: (branchName: string) => void;
  onCopyRemoteCommitUrl: (branchName: string, commitSha: string) => void;
  onCompareBranch: (comparison: BranchComparisonSelection) => void;
  onOpenPullRequestReview: (pullRequest: MatchingBranchPullRequest) => void;
  onOpenPullRequestUrl: (url: string) => void;
  onRequestRenameBranch: (branchName: string) => void;
  onRequestDeleteBranch: (branchName: string, force: boolean) => void;
  onRequestDeleteRemoteBranch: (branchName: string) => void;
};

export function BranchContextMenu({
  contextMenu,
  menuPos,
  menuRef,
  selectedBranch,
  branchRefByName,
  branchType,
  creatingWorktree,
  matchingPullRequestByHead,
  remoteUrl,
  onCloseContextMenu,
  onBeginCreateBranch,
  onCheckoutBranch,
  onRunBranchOperation,
  onRunRemoteBranchOperation,
  onRunRemoteBranchAction,
  onCreateRandomWorktreeFromBranch,
  onCopyText,
  onCopyBranchTipSha,
  onCopyRemoteBranchUrl,
  onCopyRemoteCommitUrl,
  onCompareBranch,
  onOpenPullRequestReview,
  onOpenPullRequestUrl,
  onRequestRenameBranch,
  onRequestDeleteBranch,
  onRequestDeleteRemoteBranch,
}: BranchContextMenuProps) {
  const [showOther, setShowOther] = useState(false);
  const [submenuLeft, setSubmenuLeft] = useState(true);
  const [submenuDirection, setSubmenuDirection] = useState<"down" | "up">(
    "down",
  );
  const otherRef = useRef<HTMLDivElement>(null);
  const submenuTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (submenuTimeout.current) clearTimeout(submenuTimeout.current);
    };
  }, []);

  useEffect(() => {
    setShowOther(false);
  }, [contextMenu]);

  useLayoutEffect(() => {
    if (!showOther || !otherRef.current) return;
    const rect = otherRef.current.getBoundingClientRect();
    const submenuWidth = 200;
    const submenuHeight = 220;

    setSubmenuLeft(rect.right + submenuWidth <= window.innerWidth - 8);
    setSubmenuDirection(
      rect.bottom + submenuHeight > window.innerHeight - 8 ? "up" : "down",
    );
  }, [showOther]);

  if (!contextMenu || !menuPos) return null;

  const { node } = contextMenu;
  const rowBranchName = node.full || node.name;
  const branchRef = node.type === "branch" ? branchRefByName.get(node.full) : null;
  const localBranchName = branchRef?.localName ?? null;
  const originBranchName = branchRef?.originName ?? null;
  const isRemoteRow = branchType === "remote" && Boolean(originBranchName);
  const remoteLogicalBranchName = originBranchName?.replace(/^origin\//, "") ?? null;
  const matchingPullRequest = remoteLogicalBranchName
    ? (matchingPullRequestByHead.get(remoteLogicalBranchName) ?? null)
    : null;
  const targetBranchName = isRemoteRow
    ? (originBranchName ?? rowBranchName)
    : (localBranchName ?? rowBranchName);
  const baseRef = isRemoteRow
    ? (originBranchName ?? rowBranchName)
    : (localBranchName ?? originBranchName ?? rowBranchName);
  const compareBranchName = isRemoteRow
    ? (originBranchName ?? rowBranchName)
    : (localBranchName ?? originBranchName ?? rowBranchName);
  const currentBranchLabel = selectedBranch || "current branch";
  const isBranchNode = node.type !== "group";
  const remoteActionDisabledReason = !isBranchNode
    ? "Remote actions are only available for branches"
    : !localBranchName
      ? "Remote actions are only available for local branches"
      : null;
  const remoteActionClass = remoteActionDisabledReason
    ? "px-4 py-2 text-zinc-500 cursor-not-allowed"
    : "px-4 py-2 hover:bg-zinc-700 cursor-pointer";
  const branchOperationDisabledReason = !isBranchNode
    ? "Branch operations are only available for branches"
    : isRemoteRow
      ? null
    : !localBranchName
      ? "Branch operations are only available for local branches"
      : !selectedBranch
        ? "Branch operations require a current local branch"
        : selectedBranch === localBranchName
          ? "Source and target branch are the same"
          : null;
  const branchOperationClass = branchOperationDisabledReason
    ? "px-4 py-2 text-zinc-500 cursor-not-allowed"
    : "px-4 py-2 hover:bg-zinc-700 cursor-pointer";
  const localBranchActionDisabledReason = !isBranchNode
    ? "This action is only available for branches"
    : !targetBranchName
      ? "Checkout is only available for branches"
      : null;
  const localBranchActionClass = localBranchActionDisabledReason
    ? "px-4 py-2 text-zinc-500 cursor-not-allowed"
    : "px-4 py-2 hover:bg-zinc-700 cursor-pointer";
  const createWorktreeDisabledReason = !isBranchNode
    ? "This action is only available for branches"
    : creatingWorktree
      ? "A worktree is already being created"
      : null;
  const createWorktreeActionClass = createWorktreeDisabledReason
    ? "px-4 py-2 text-zinc-500 cursor-not-allowed"
    : "px-4 py-2 hover:bg-zinc-700 cursor-pointer";
  const compareDisabledReason = !isBranchNode
    ? "Compare is only available for branches"
    : !selectedBranch
      ? "Compare requires a current local branch"
      : selectedBranch === compareBranchName
        ? "Source and target branch are the same"
        : null;
  const compareActionClass = compareDisabledReason
    ? "px-4 py-2 text-zinc-500 cursor-not-allowed"
    : "px-4 py-2 hover:bg-zinc-700 cursor-pointer";
  const remoteBranchOperationDisabledReason = !isBranchNode
    ? "Branch operations are only available for branches"
    : !isRemoteRow || !originBranchName
      ? "Remote branch operations are only available for remote branches"
      : !selectedBranch
        ? "Remote branch operations require a current local branch"
        : null;
  const remoteBranchOperationClass = remoteBranchOperationDisabledReason
    ? "px-4 py-2 text-zinc-500 cursor-not-allowed"
    : "px-4 py-2 hover:bg-zinc-700 cursor-pointer";

  function closeMenus() {
    onCloseContextMenu();
    setShowOther(false);
  }

  function handleMenuMouseLeave(event: React.MouseEvent) {
    const relatedTarget = event.relatedTarget as HTMLElement;
    if (relatedTarget?.closest(".submenu")) return;
    submenuTimeout.current = setTimeout(() => {
      closeMenus();
    }, 500);
  }

  function handleSubmenuMouseEnter() {
    if (submenuTimeout.current) {
      clearTimeout(submenuTimeout.current);
      submenuTimeout.current = null;
    }
    setShowOther(true);
  }

  function handleSubmenuMouseLeave() {
    submenuTimeout.current = setTimeout(() => {
      setShowOther(false);
    }, 500);
  }

  return ReactDOM.createPortal(
    <div
      ref={menuRef}
      style={{
        position: "fixed",
        top: menuPos.y,
        left: menuPos.x,
        zIndex: 99999,
      }}
      className="flex"
      onMouseLeave={handleMenuMouseLeave}
    >
      <div className="z-[99999] min-w-[320px] select-none rounded border border-border bg-background-emphasis py-1 text-xs text-zinc-200 shadow-lg">
        {isRemoteRow && originBranchName ? null : (
          <>
            <BranchContextMenuRemoteActions
              branchName={targetBranchName}
              disabledReason={remoteActionDisabledReason}
              itemClass={remoteActionClass}
              onRunRemoteAction={(
                command,
                pendingAction,
                successTitle,
                successDetails,
                failureTitle,
              ) => {
                if (remoteActionDisabledReason) return;
                closeMenus();
                onRunRemoteBranchAction(
                  command,
                  targetBranchName,
                  pendingAction,
                  successTitle,
                  successDetails,
                  failureTitle,
                );
              }}
            />
            <BranchContextMenuSeparator />
            <BranchContextMenuBranchOperations
              branchName={targetBranchName}
              selectedBranch={selectedBranch}
              currentBranchLabel={currentBranchLabel}
              disabledReason={branchOperationDisabledReason}
              itemClass={branchOperationClass}
              onRunBranchOperation={(...args) => {
                closeMenus();
                onRunBranchOperation(...args);
              }}
            />
          </>
        )}
        {isRemoteRow && originBranchName ? (
          <BranchContextMenuRemoteBranchOperations
            remoteBranchName={originBranchName}
            currentBranchLabel={currentBranchLabel}
            disabledReason={remoteBranchOperationDisabledReason}
            itemClass={remoteBranchOperationClass}
            onRunRemoteBranchOperation={(...args) => {
              closeMenus();
              onRunRemoteBranchOperation(...args);
            }}
          />
        ) : null}
        <BranchContextMenuSeparator />
        <BranchContextMenuWorktreeActions
          branchName={targetBranchName}
          worktreeBaseRef={baseRef}
          localBranchActionDisabledReason={localBranchActionDisabledReason}
          localBranchActionClass={localBranchActionClass}
          createWorktreeDisabledReason={createWorktreeDisabledReason}
          createWorktreeActionClass={createWorktreeActionClass}
          creatingWorktree={creatingWorktree}
          onCheckoutBranch={(targetBranch) => {
            closeMenus();
            onCheckoutBranch(targetBranch);
          }}
          onCreateRandomWorktreeFromBranch={(targetBranch) => {
            closeMenus();
            onCreateRandomWorktreeFromBranch(targetBranch);
          }}
        />
        <BranchContextMenuSeparator />
        <BranchContextMenuBranchingItems
          node={node}
          baseRef={baseRef}
          isBranchNode={isBranchNode}
          selectedBranch={selectedBranch}
          onBeginCreateBranch={onBeginCreateBranch}
          onCloseMenus={closeMenus}
        />
        <BranchContextMenuSeparator />
        <BranchContextMenuCompareItems
          branchName={compareBranchName}
          currentBranch={selectedBranch ?? null}
          disabledReason={compareDisabledReason}
          itemClass={compareActionClass}
          onCompareBranch={onCompareBranch}
          onCloseMenus={closeMenus}
        />
        <BranchContextMenuSeparator />
        <BranchContextMenuOtherActions
          branchName={baseRef}
          remoteBranchName={originBranchName}
          remoteCommitSha={branchRef?.originTargetId ?? null}
          hasRemoteProviderUrl={Boolean(remoteUrl)}
          showOther={showOther}
          submenuLeft={submenuLeft}
          submenuDirection={submenuDirection}
          otherRef={otherRef}
          onShowOtherChange={setShowOther}
          onCloseMenus={closeMenus}
          onCopyText={onCopyText}
          onCopyBranchTipSha={onCopyBranchTipSha}
          onCopyRemoteBranchUrl={onCopyRemoteBranchUrl}
          onCopyRemoteCommitUrl={onCopyRemoteCommitUrl}
          onSubmenuMouseEnter={handleSubmenuMouseEnter}
          onSubmenuMouseLeave={handleSubmenuMouseLeave}
        />
        {matchingPullRequest ? (
          <>
            <BranchContextMenuSeparator />
            <BranchContextMenuPullRequestActions
              pullRequest={matchingPullRequest}
              onCopyText={(...args) => {
                closeMenus();
                onCopyText(...args);
              }}
              onOpenPullRequestReview={(pullRequest) => {
                closeMenus();
                onOpenPullRequestReview(pullRequest);
              }}
              onOpenPullRequestUrl={(url) => {
                closeMenus();
                onOpenPullRequestUrl(url);
              }}
            />
          </>
        ) : null}
        <BranchContextMenuSeparator />
        <BranchContextMenuDangerZone
          branchName={targetBranchName}
          remoteBranchName={isRemoteRow ? originBranchName : null}
          localBranchActionDisabledReason={localBranchActionDisabledReason}
          localBranchActionClass={localBranchActionClass}
          onRequestRenameBranch={(targetBranch) => {
            closeMenus();
            onRequestRenameBranch(targetBranch);
          }}
          onRequestDeleteBranch={(targetBranch, force) => {
            closeMenus();
            onRequestDeleteBranch(targetBranch, force);
          }}
          onRequestDeleteRemoteBranch={(targetBranch) => {
            closeMenus();
            onRequestDeleteRemoteBranch(targetBranch);
          }}
        />
      </div>
    </div>,
    document.body,
  );
}
