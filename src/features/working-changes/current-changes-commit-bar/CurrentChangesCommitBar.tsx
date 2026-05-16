import { useState } from "react";
import { pushRepository } from "@/shared/api/git/staging";
import { stashSelectedFiles } from "@/shared/api/git/stashes";
import { APP_EVENTS } from "@/shared/config/events";
import { IconChevronDown } from "@/components/icons";
import { useGitActionsStore } from "@/features/repository-workspace/stores/gitActionsStore";
import { useRepoStore } from "@/features/repository-workspace/stores/repoStore";
import { useStagedLinesStore } from "@/features/working-changes/stores/stagingStore";
import { useStageAndCommit } from "../hooks/useStageAndCommit";

type CurrentChangesCommitBarProps = {
  repoPath: string;
  onCommitted?: () => void;
};

export default function CurrentChangesCommitBar({
  repoPath,
  onCommitted,
}: CurrentChangesCommitBarProps) {
  const [message, setMessage] = useState("");
  const [push, setPush] = useState(false);
  const [amend, setAmend] = useState(false);
  const [showCommitMenu, setShowCommitMenu] = useState(false);
  const [stashLoading, setStashLoading] = useState(false);
  const { commitStagedChanges, loading, error } = useStageAndCommit();
  const clearAllStagedLines = useStagedLinesStore((s) => s.clearAllStagedLines);
  const setPendingGitAction = useGitActionsStore((s) => s.setPendingAction);
  const setGitActionNotice = useGitActionsStore((s) => s.setNotice);
  const hasStagedChanges = useStagedLinesStore((s) =>
    Object.values(s.stagedLines).some((fileSelection) => {
      if (!fileSelection) return false;
      if (fileSelection.isNewFile || fileSelection.isWholeFileStaged) return true;

      return Object.values(fileSelection).some(
        (value) => value instanceof Set && value.size > 0,
      );
    }),
  );
  const activeTabId = useRepoStore((s) => s.activeTabId);
  const selectedBranch = useRepoStore((s) =>
    s.tabs.find((t) => t.id === activeTabId)?.selectedBranch ?? null,
  );
  const isBusy = loading || stashLoading;

  const notifyCommitRefresh = () => {
    window.dispatchEvent(new CustomEvent(APP_EVENTS.commitsRefresh));
  };

  const notifyWorkingChangesRefresh = () => {
    window.dispatchEvent(new CustomEvent(APP_EVENTS.workingChangesRefresh));
  };

  const notifyStashesRefresh = () => {
    window.dispatchEvent(new CustomEvent(APP_EVENTS.stashesRefresh));
  };

  const handlePushSuccess = () => {
    setGitActionNotice({
      kind: "success",
      title: "git push succeeded",
      details: selectedBranch
        ? `Pushed the current branch to origin/${selectedBranch}.`
        : "Pushed the current branch successfully.",
      expanded: false,
    });
  };

  const handlePushError = (pushError: unknown) => {
    const details =
      pushError instanceof Error
        ? pushError.message
        : String(pushError || "Unknown error");

    setGitActionNotice({
      kind: "error",
      title: "git push failed",
      details,
      expanded: false,
    });
  };

  const handleCommit = async (pushOverride?: boolean) => {
    if (!message.trim() || isBusy || !hasStagedChanges) return;

    try {
      await commitStagedChanges(repoPath, message, {
        push: false,
        amend,
      });
      notifyCommitRefresh();

      if (pushOverride ?? push) {
        setPendingGitAction("push");
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => resolve());
          });
        });
        try {
          await pushRepository(repoPath);
          handlePushSuccess();
          notifyCommitRefresh();
        } catch (pushError) {
          handlePushError(pushError);
        } finally {
          setPendingGitAction(null);
        }
      }

      setMessage("");
      setShowCommitMenu(false);
      onCommitted?.();
    } catch {
      // Error is surfaced by useStageAndCommit.
    }
  };

  const getSelectedFilePathsForStash = () => {
    const stagedLines = useStagedLinesStore.getState().stagedLines;
    return Object.entries(stagedLines)
      .filter(([, fileSelection]) => {
        if (!fileSelection) return false;
        if (fileSelection.isNewFile || fileSelection.isWholeFileStaged) return true;
        return Object.values(fileSelection).some(
          (value) => value instanceof Set && value.size > 0,
        );
      })
      .map(([filePath]) => filePath);
  };

  const handleStashSelection = async () => {
    if (isBusy) return;
    const selectedFiles = getSelectedFilePathsForStash();
    if (selectedFiles.length === 0) return;

    setStashLoading(true);
    try {
      const stashMessage = `WIP-${selectedBranch ?? "HEAD"}`;
      await stashSelectedFiles(repoPath, selectedFiles, stashMessage);

      clearAllStagedLines();
      notifyWorkingChangesRefresh();
      notifyStashesRefresh();
      setGitActionNotice({
        kind: "success",
        title: "git stash succeeded",
        details: `Stashed ${selectedFiles.length} selected file(s).`,
        expanded: false,
      });
      setShowCommitMenu(false);
      onCommitted?.();
    } catch (stashError) {
      const details =
        stashError instanceof Error
          ? stashError.message
          : String(stashError || "Unknown error");
      setGitActionNotice({
        kind: "error",
        title: "git stash failed",
        details,
        expanded: false,
      });
    } finally {
      setStashLoading(false);
    }
  };

  return (
    <div className="border-t border-border bg-background-emphasis px-2 pb-2 pt-1.5">
      <div className="flex flex-col gap-1.5">
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Enter commit message"
          className="h-20 w-full resize-none rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          disabled={isBusy}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              if (event.metaKey || event.ctrlKey) {
                void handleCommit(true);
                return;
              }
              void handleCommit();
            }
          }}
        />
        <div className="flex h-8 items-center justify-between gap-2">
          <div className="flex h-8 items-center gap-3 text-xs text-zinc-300">
            <label className="inline-flex h-8 items-center gap-1.5">
              <input
                type="checkbox"
                checked={push}
                onChange={(event) => setPush(event.target.checked)}
                disabled={isBusy}
              />
              Push
            </label>
          </div>
          <div className="relative inline-flex h-8 items-center">
            <button
              type="button"
              onClick={() => {
                void handleCommit();
              }}
              disabled={isBusy || !message.trim() || !hasStagedChanges}
              className="h-8 rounded-l border border-r-0 border-border bg-zinc-800 px-3 text-xs font-semibold text-zinc-100 transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {amend ? "Amend" : "Commit"}
            </button>
            <button
              type="button"
              onClick={() => setShowCommitMenu((prev) => !prev)}
              disabled={isBusy}
              className="h-8 rounded-r border border-border bg-zinc-800 px-2 text-xs font-semibold text-zinc-100 transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Commit options"
            >
              <IconChevronDown size={14} />
            </button>
            {showCommitMenu ? (
              <div className="absolute bottom-9 right-0 z-[10020] min-w-[120px] rounded border border-zinc-700 bg-zinc-900 text-xs text-zinc-100 shadow-lg">
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left hover:bg-zinc-800"
                  onClick={() => {
                    setAmend(false);
                    setShowCommitMenu(false);
                  }}
                >
                  Commit
                </button>
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left hover:bg-zinc-800"
                  onClick={() => {
                    setAmend(true);
                    setShowCommitMenu(false);
                  }}
                >
                  Amend
                </button>
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left hover:bg-zinc-800 disabled:cursor-not-allowed disabled:text-zinc-500"
                  onClick={() => {
                    void handleStashSelection();
                  }}
                  disabled={isBusy || !hasStagedChanges}
                >
                  Stash
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      {error ? <div className="mt-1 text-xs text-red-400">{error}</div> : null}
    </div>
  );
}
