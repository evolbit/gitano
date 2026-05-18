import { IconChevronDown, IconSparkles } from "@/components/icons";
import { LocalAiResultModal, LocalAiSetupModal } from "@/features/local-ai";
import { useGitActionsStore } from "@/features/repository-workspace/stores/git-actions-store";
import { useRepoStore } from "@/features/repository-workspace/stores/repo-store";
import { useStagedLinesStore } from "@/features/working-changes/stores/staging-store";
import { pushRepository } from "@/shared/api/git/staging";
import { stashSelectedFiles } from "@/shared/api/git/stashes";
import { runLocalAiAction, type LocalAiRunResult } from "@/shared/api/local-ai";
import { getRepositoryState } from "@/shared/api/repositories";
import { APP_EVENTS } from "@/shared/config/events";
import { useEffect, useState } from "react";
import { useStageAndCommit } from "../hooks/use-stage-and-commit";

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
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showAiSetup, setShowAiSetup] = useState(false);
  const [conflictAiResult, setConflictAiResult] =
    useState<LocalAiRunResult | null>(null);
  const [conflictAiLoading, setConflictAiLoading] = useState(false);
  const [conflictAiError, setConflictAiError] = useState<string | null>(null);
  const [showConflictAiSetup, setShowConflictAiSetup] = useState(false);
  const [requiresInitialCommit, setRequiresInitialCommit] = useState(false);
  const { commitStagedChanges, loading, error } = useStageAndCommit();
  const clearAllStagedLines = useStagedLinesStore((s) => s.clearAllStagedLines);
  const setPendingGitAction = useGitActionsStore((s) => s.setPendingAction);
  const setGitActionNotice = useGitActionsStore((s) => s.setNotice);
  const hasStagedChanges = useStagedLinesStore((s) =>
    Object.values(s.stagedLines).some((fileSelection) => {
      if (!fileSelection) return false;
      if (fileSelection.isNewFile || fileSelection.isWholeFileStaged)
        return true;

      return Object.values(fileSelection).some(
        (value) => value instanceof Set && value.size > 0,
      );
    }),
  );
  const activeTabId = useRepoStore((s) => s.activeTabId);
  const selectedBranch = useRepoStore(
    (s) => s.tabs.find((t) => t.id === activeTabId)?.selectedBranch ?? null,
  );
  const isBusy = loading || stashLoading || aiLoading || conflictAiLoading;

  useEffect(() => {
    let cancelled = false;

    const refreshRepositoryState = async () => {
      try {
        const state = await getRepositoryState(repoPath);
        if (cancelled) return;
        const nextRequiresInitialCommit = state.hasCommits === false;
        setRequiresInitialCommit(nextRequiresInitialCommit);
        if (nextRequiresInitialCommit) {
          setAmend(false);
          setPush(false);
        }
      } catch {
        if (!cancelled) {
          setRequiresInitialCommit(false);
        }
      }
    };

    void refreshRepositoryState();

    const handleRepoRefsRefresh = () => {
      void refreshRepositoryState();
    };

    window.addEventListener(APP_EVENTS.repoRefsRefresh, handleRepoRefsRefresh);
    return () => {
      cancelled = true;
      window.removeEventListener(
        APP_EVENTS.repoRefsRefresh,
        handleRepoRefsRefresh,
      );
    };
  }, [repoPath]);

  const notifyCommitRefresh = () => {
    window.dispatchEvent(new CustomEvent(APP_EVENTS.commitsRefresh));
  };

  const notifyRepoRefsRefresh = () => {
    window.dispatchEvent(new CustomEvent(APP_EVENTS.repoRefsRefresh));
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
      notifyRepoRefsRefresh();
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
        if (fileSelection.isNewFile || fileSelection.isWholeFileStaged)
          return true;
        return Object.values(fileSelection).some(
          (value) => value instanceof Set && value.size > 0,
        );
      })
      .map(([filePath]) => filePath);
  };

  const handleStashSelection = async () => {
    if (isBusy || requiresInitialCommit) return;
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

  const shouldOpenAiSetup = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    return (
      message.includes("LOCAL_AI_MODEL_SETUP_REQUIRED") ||
      message.toLowerCase().includes("ollama") ||
      message.toLowerCase().includes("local ai")
    );
  };

  const handleGenerateCommitMessage = async () => {
    if (isBusy || !hasStagedChanges) return;

    setAiLoading(true);
    setAiError(null);
    try {
      const result = await runLocalAiAction({
        repoPath,
        actionKind: "commitMessage",
      });
      if (result.result.kind === "commitMessage") {
        setMessage(result.result.data.message);
      }
    } catch (generateError) {
      if (shouldOpenAiSetup(generateError)) {
        setShowAiSetup(true);
      } else {
        setAiError(
          generateError instanceof Error
            ? generateError.message
            : String(generateError || "AI commit message generation failed"),
        );
      }
    } finally {
      setAiLoading(false);
    }
  };

  const handleSuggestConflictResolution = async (forceRefresh = false) => {
    if (isBusy) return;

    setConflictAiLoading(true);
    setConflictAiError(null);
    try {
      const result = await runLocalAiAction({
        repoPath,
        actionKind: "mergeConflictSuggestions",
        forceRefresh,
      });
      setConflictAiResult(result);
    } catch (suggestionError) {
      if (shouldOpenAiSetup(suggestionError)) {
        setShowConflictAiSetup(true);
      } else {
        setConflictAiError(
          suggestionError instanceof Error
            ? suggestionError.message
            : String(suggestionError || "AI conflict suggestion failed"),
        );
        setConflictAiResult(null);
      }
    } finally {
      setConflictAiLoading(false);
    }
  };

  return (
    <div className="border-t border-border bg-background-emphasis px-2 pb-2 pt-1.5">
      <div className="flex flex-col gap-1.5">
        <div className="relative">
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Enter commit message"
            className="h-20 w-full resize-none rounded border border-border bg-background px-2 py-1.5 pb-9 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
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
          <button
            type="button"
            onClick={() => {
              void handleGenerateCommitMessage();
            }}
            disabled={isBusy || !hasStagedChanges}
            className="absolute bottom-4 left-2 inline-flex h-7 w-7 items-center justify-center rounded border border-border bg-zinc-800 text-zinc-100 transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
            title={
              aiLoading
                ? "Generating commit message"
                : "Generate commit message locally"
            }
          >
            <IconSparkles size={14} />
            <span className="sr-only">
              {aiLoading
                ? "Generating commit message"
                : "Generate commit message"}
            </span>
          </button>
        </div>
        <div className="flex h-8 items-center justify-between gap-2">
          <div className="flex h-8 items-center gap-3 text-xs text-zinc-300">
            <label className="inline-flex h-8 items-center gap-1.5">
              <input
                type="checkbox"
                checked={push}
                onChange={(event) => setPush(event.target.checked)}
                disabled={isBusy || requiresInitialCommit}
                title={
                  requiresInitialCommit
                    ? "Create the initial commit before pushing"
                    : undefined
                }
              />
              Push
            </label>
          </div>
          <div className="relative inline-flex h-8 items-center gap-2">
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
                  className="block w-full px-3 py-2 text-left hover:bg-zinc-800 disabled:cursor-not-allowed disabled:text-zinc-500"
                  onClick={() => {
                    setAmend(true);
                    setShowCommitMenu(false);
                  }}
                  disabled={requiresInitialCommit}
                  title={
                    requiresInitialCommit
                      ? "Create the initial commit before amending"
                      : undefined
                  }
                >
                  Amend
                </button>
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left hover:bg-zinc-800 disabled:cursor-not-allowed disabled:text-zinc-500"
                  onClick={() => {
                    void handleStashSelection();
                  }}
                  disabled={
                    isBusy || !hasStagedChanges || requiresInitialCommit
                  }
                  title={
                    requiresInitialCommit
                      ? "Create the initial commit before stashing"
                      : undefined
                  }
                >
                  Stash
                </button>
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left hover:bg-zinc-800 disabled:cursor-not-allowed disabled:text-zinc-500"
                  onClick={() => {
                    setShowCommitMenu(false);
                    void handleSuggestConflictResolution();
                  }}
                  disabled={isBusy || requiresInitialCommit}
                >
                  Suggest conflicts
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      {error ? <div className="mt-1 text-xs text-red-400">{error}</div> : null}
      {aiError ? (
        <div className="mt-1 text-xs text-red-400">{aiError}</div>
      ) : null}
      <LocalAiSetupModal
        open={showAiSetup}
        actionKind="commitMessage"
        onClose={() => setShowAiSetup(false)}
        onReady={() => {
          setShowAiSetup(false);
          void handleGenerateCommitMessage();
        }}
      />
      <LocalAiResultModal
        open={
          Boolean(conflictAiResult) ||
          conflictAiLoading ||
          Boolean(conflictAiError)
        }
        title="Suggest conflict resolution"
        result={conflictAiResult}
        loading={conflictAiLoading}
        error={conflictAiError}
        onRefresh={() => {
          void handleSuggestConflictResolution(true);
        }}
        onClose={() => {
          setConflictAiResult(null);
          setConflictAiError(null);
        }}
      />
      <LocalAiSetupModal
        open={showConflictAiSetup}
        actionKind="mergeConflictSuggestions"
        onClose={() => setShowConflictAiSetup(false)}
        onReady={() => {
          setShowConflictAiSetup(false);
          void handleSuggestConflictResolution();
        }}
      />
    </div>
  );
}
