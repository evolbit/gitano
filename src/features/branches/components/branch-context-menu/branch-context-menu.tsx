import ReactDOM from "react-dom";
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { GitBranchRef } from "@/shared/types/git";
import { BranchContextMenuBranchingItems } from "../branch-context-menu-branching-items/branch-context-menu-branching-items";
import { BranchContextMenuBranchOperations } from "../branch-context-menu-branch-operations/branch-context-menu-branch-operations";
import { BranchContextMenuCompareItems } from "../branch-context-menu-compare-items/branch-context-menu-compare-items";
import { BranchContextMenuDangerZone } from "../branch-context-menu-danger-zone/branch-context-menu-danger-zone";
import { BranchContextMenuOtherActions } from "../branch-context-menu-other-actions/branch-context-menu-other-actions";
import { BranchContextMenuRemoteActions } from "../branch-context-menu-remote-actions/branch-context-menu-remote-actions";
import { BranchContextMenuSeparator } from "../branch-context-menu-parts/branch-context-menu-parts";
import { BranchContextMenuWorktreeActions } from "../branch-context-menu-worktree-actions/branch-context-menu-worktree-actions";
import type {
  BranchContextMenuState,
  BranchOperationCommand,
  MenuPosition,
  PendingRemoteBranchAction,
  RemoteBranchActionCommand,
  BranchComparisonSelection,
} from "../../types";

type BranchContextMenuProps = {
  contextMenu: BranchContextMenuState | null;
  menuPos: MenuPosition | null;
  menuRef: RefObject<HTMLDivElement>;
  selectedBranch?: string | null;
  branchRefByName: Map<string, GitBranchRef>;
  creatingWorktree: boolean;
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
  onCompareBranch: (comparison: BranchComparisonSelection) => void;
  onRequestRenameBranch: (branchName: string) => void;
  onRequestDeleteBranch: (branchName: string, force: boolean) => void;
};

export function BranchContextMenu({
  contextMenu,
  menuPos,
  menuRef,
  selectedBranch,
  branchRefByName,
  creatingWorktree,
  onCloseContextMenu,
  onBeginCreateBranch,
  onCheckoutBranch,
  onRunBranchOperation,
  onRunRemoteBranchAction,
  onCreateRandomWorktreeFromBranch,
  onCopyText,
  onCopyBranchTipSha,
  onCompareBranch,
  onRequestRenameBranch,
  onRequestDeleteBranch,
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
  const targetBranchName = localBranchName ?? rowBranchName;
  const baseRef = localBranchName ?? branchRef?.originName ?? rowBranchName;
  const compareBranchName = localBranchName ?? branchRef?.originName ?? rowBranchName;
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
    : !localBranchName
      ? "Checkout is only available for local branches"
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
          showOther={showOther}
          submenuLeft={submenuLeft}
          submenuDirection={submenuDirection}
          otherRef={otherRef}
          onShowOtherChange={setShowOther}
          onCloseMenus={closeMenus}
          onCopyText={onCopyText}
          onCopyBranchTipSha={onCopyBranchTipSha}
          onSubmenuMouseEnter={handleSubmenuMouseEnter}
          onSubmenuMouseLeave={handleSubmenuMouseLeave}
        />
        <BranchContextMenuSeparator />
        <BranchContextMenuDangerZone
          branchName={targetBranchName}
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
        />
      </div>
    </div>,
    document.body,
  );
}
