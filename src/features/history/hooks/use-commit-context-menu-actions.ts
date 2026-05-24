import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { getCommitPatch } from "@/shared/api/git/commits";
import { buildRemoteCommitUrl } from "@/shared/lib/git/remote-url";
import { writeClipboardTextFromPromise } from "@/shared/platform/clipboard";
import { openExternalUrl } from "@/shared/platform/tauri/opener";
import type { CommitListItem } from "@/shared/types/git";
import type { CommitContextMenuAction } from "../components/commit-list/components/commit-context-menu/commit-context-menu";
import type {
  CommitCompareState,
  CommitContextMenuState,
  CommitDialogState,
  CommitTableRow,
} from "../types/commit-list";

type UseCommitContextMenuActionsParams = {
  copyText: (
    text: string,
    successTitle: string,
    successDetails: string,
  ) => Promise<void>;
  notifyError: (title: string, actionError: unknown) => void;
  notifySuccess: (title: string, details: string) => void;
  openCommitDialog: (
    kind: CommitDialogState["kind"],
    commit: CommitListItem,
  ) => void;
  remoteUrl: string | null;
  repoPath?: string | null;
  runCommitAiAnalysis: (
    commit: CommitListItem,
    forceRefresh?: boolean,
  ) => Promise<void>;
  selectedBranch?: string | null;
  setCommitCompare: Dispatch<SetStateAction<CommitCompareState | null>>;
  setKeyboardNavigation: (keyboardNavigation: boolean) => void;
};

export function useCommitContextMenuActions({
  copyText,
  notifyError,
  notifySuccess,
  openCommitDialog,
  remoteUrl,
  repoPath,
  runCommitAiAnalysis,
  selectedBranch,
  setCommitCompare,
  setKeyboardNavigation,
}: UseCommitContextMenuActionsParams) {
  const [contextMenu, setContextMenu] =
    useState<CommitContextMenuState | null>(null);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
    setMenuPos(null);
  }, []);

  useEffect(() => {
    if (!contextMenu) return;

    function handleClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        closeContextMenu();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeContextMenu();
      }
    }

    window.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeContextMenu, contextMenu]);

  useLayoutEffect(() => {
    if (!contextMenu || !menuRef.current || !menuPos) return;
    const rect = menuRef.current.getBoundingClientRect();
    const nextPos = { ...menuPos };

    if (menuPos.y + rect.height > window.innerHeight - 8) {
      nextPos.y = Math.max(8, menuPos.y - rect.height);
    }

    if (menuPos.x + rect.width > window.innerWidth - 8) {
      nextPos.x = Math.max(8, window.innerWidth - rect.width - 8);
    }

    if (nextPos.x !== menuPos.x || nextPos.y !== menuPos.y) {
      setMenuPos(nextPos);
    }
  }, [contextMenu, menuPos]);

  const handleRowContextMenu = useCallback(
    (row: CommitTableRow, _index: number, event: React.MouseEvent) => {
      event.preventDefault();
      setKeyboardNavigation(false);
      setContextMenu({ row, x: event.clientX, y: event.clientY });
      setMenuPos({ x: event.clientX, y: event.clientY });
    },
    [setKeyboardNavigation],
  );

  const handleCommitMenuAction = useCallback(
    (action: CommitContextMenuAction) => {
      if (!contextMenu || !repoPath) return;

      const { commit } = contextMenu.row;
      const remoteCommitUrl = remoteUrl
        ? buildRemoteCommitUrl(remoteUrl, commit.sha)
        : null;
      closeContextMenu();

      switch (action) {
        case "copySha":
          void copyText(
            commit.sha,
            "Copied commit SHA",
            `Copied ${commit.sha.slice(0, 12)}.`,
          );
          return;
        case "copyMessage":
          void copyText(
            commit.message,
            "Copied commit message",
            `Copied message for ${commit.sha.slice(0, 12)}.`,
          );
          return;
        case "copyPatch":
          void writeClipboardTextFromPromise(
            getCommitPatch(repoPath, commit.sha),
          )
            .then(() =>
              notifySuccess(
                "Copied patch",
                `Copied patch for ${commit.sha.slice(0, 12)}.`,
              ),
            )
            .catch((patchError) =>
              notifyError("Copy patch failed", patchError),
            );
          return;
        case "analyzeWithAi":
          void runCommitAiAnalysis(commit);
          return;
        case "compareWithParent":
          setCommitCompare({ mode: "parent", commit });
          return;
        case "compareWithWorkingTree":
          setCommitCompare({ mode: "workingTree", commit });
          return;
        case "createBranch":
          openCommitDialog("branch", commit);
          return;
        case "createTag":
          openCommitDialog("tag", commit);
          return;
        case "createWorktree":
          openCommitDialog("worktree", commit);
          return;
        case "cherryPick":
          if (selectedBranch) openCommitDialog("cherryPick", commit);
          return;
        case "revert":
          if (selectedBranch) openCommitDialog("revert", commit);
          return;
        case "openRemote":
          if (remoteCommitUrl) {
            void openExternalUrl(remoteCommitUrl).catch((openError) =>
              notifyError("Open commit on remote failed", openError),
            );
          }
          return;
        case "copyRemoteUrl":
          if (remoteCommitUrl) {
            void copyText(
              remoteCommitUrl,
              "Copied commit URL",
              `Copied remote URL for ${commit.sha.slice(0, 12)}.`,
            );
          }
          return;
      }
    },
    [
      closeContextMenu,
      contextMenu,
      copyText,
      notifyError,
      notifySuccess,
      openCommitDialog,
      remoteUrl,
      repoPath,
      runCommitAiAnalysis,
      selectedBranch,
      setCommitCompare,
    ],
  );

  const contextMenuRemoteCommitUrl =
    contextMenu && remoteUrl
      ? buildRemoteCommitUrl(remoteUrl, contextMenu.row.commit.sha)
      : null;

  return {
    contextMenu,
    handleCommitMenuAction,
    handleRowContextMenu,
    menuPos,
    menuRef,
    remoteCommitUrl: contextMenuRemoteCommitUrl,
  };
}
