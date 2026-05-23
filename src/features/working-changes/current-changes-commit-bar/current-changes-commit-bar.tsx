import { IconChevronDown, IconSparkles } from "@/components/icons";
import { LocalAiResultModal, LocalAiSetupModal } from "@/features/local-ai";
import { useGitActionsStore } from "@/features/repository-workspace/stores/git-actions-store";
import { useRepoStore } from "@/features/repository-workspace/stores/repo-store";
import { useStagedLinesStore } from "@/features/working-changes/stores/staging-store";
import { pushRepository } from "@/shared/api/git/staging";
import { stashSelectedFiles } from "@/shared/api/git/stashes";
import {
  getLocalAiModelPreferences,
  getLocalAiModelStatus,
  runLocalAiAction,
  type AnalysisEngine,
  type LocalAiActionKind,
  type LocalAiPreferences,
  type LocalAiRunResult,
} from "@/shared/api/local-ai";
import { getRepositoryState } from "@/shared/api/repositories";
import { APP_EVENTS } from "@/shared/config/events";
import { useEffect, useState } from "react";
import { useStageAndCommit } from "../hooks/use-stage-and-commit";

type CurrentChangesCommitBarProps = {
  repoPath: string;
  onCommitted?: () => void;
};

function localModelEngine(modelId: string | null): AnalysisEngine {
  return {
    type: "local_model",
    modelId,
  };
}

function globalAnalysisEngine(
  preferences: LocalAiPreferences,
): AnalysisEngine {
  return (
    preferences.analysisEngine ??
    localModelEngine(preferences.globalModelId?.trim() || null)
  );
}

function effectiveActionEngine(
  preferences: LocalAiPreferences,
  actionKind: LocalAiActionKind,
): AnalysisEngine {
  const globalEngine = globalAnalysisEngine(preferences);
  const actionEngine = preferences.actionEngines?.[actionKind];

  if (actionEngine?.type === "external_agent") {
    return actionEngine;
  }

  if (actionEngine?.type === "local_model") {
    const actionModelId = actionEngine.modelId?.trim();
    if (actionModelId) return localModelEngine(actionModelId);
    return globalEngine.type === "external_agent"
      ? globalEngine
      : localModelEngine(null);
  }

  const legacyActionModelId = preferences.actionModelIds?.[actionKind]?.trim();
  if (legacyActionModelId) return localModelEngine(legacyActionModelId);

  return globalEngine.type === "external_agent"
    ? globalEngine
    : localModelEngine(null);
}

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

  const getAiErrorMessage = (actionError: unknown, fallback: string) =>
    actionError instanceof Error
      ? actionError.message
      : String(actionError || fallback);

  const notifyAiError = (title: string, actionError: unknown) => {
    setGitActionNotice({
      kind: "error",
      title,
      details: getAiErrorMessage(actionError, title),
      expanded: false,
    });
  };

  const actionLabel = (actionKind: LocalAiActionKind) => {
    switch (actionKind) {
      case "commitMessage":
        return "Commit";
      case "mergeConflictSuggestions":
        return "Merge conflicts";
      case "commitAnalysis":
        return "Commit review";
      case "branchAnalysis":
        return "Branch analysis";
      case "branchReview":
        return "Branch review";
    }
  };

  const ensureActionModelReady = async (actionKind: LocalAiActionKind) => {
    try {
      const preferences = await getLocalAiModelPreferences();
      const actionEngine = effectiveActionEngine(preferences, actionKind);

      if (actionEngine.type === "external_agent") {
        return true;
      }

      const actionModelId = actionEngine.modelId?.trim();

      if (!actionModelId) {
        notifyAiError(
          `No AI model selected for ${actionLabel(actionKind)}`,
          `No AI model selected for ${actionLabel(actionKind)}`,
        );
        return false;
      }

      const status = await getLocalAiModelStatus(actionModelId);

      if (status?.runtime.available && !status.ready) {
        notifyAiError(
          `No AI model selected for ${actionLabel(actionKind)}`,
          `No AI model selected for ${actionLabel(actionKind)}`,
        );
        return false;
      }
    } catch (modelError) {
      notifyAiError("Local AI configuration failed", modelError);
      return false;
    }

    return true;
  };

  const handleGenerateCommitMessage = async () => {
    if (isBusy || !hasStagedChanges) return;
    if (!(await ensureActionModelReady("commitMessage"))) return;

    setAiLoading(true);
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
        notifyAiError("AI commit message generation failed", generateError);
      }
    } finally {
      setAiLoading(false);
    }
  };

  const handleSuggestConflictResolution = async (forceRefresh = false) => {
    if (isBusy) return;
    if (!(await ensureActionModelReady("mergeConflictSuggestions"))) return;

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
        notifyAiError("AI conflict suggestion failed", suggestionError);
        setConflictAiResult(null);
      }
    } finally {
      setConflictAiLoading(false);
    }
  };

  return (
    <div className="border-t border-border bg-background-emphasis px-2 pb-2 pt-1.5">
      <div className="flex flex-col gap-1.5">
        <div
          role="group"
          aria-label="Commit message controls"
          className="overflow-visible rounded border border-border bg-background"
        >
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Enter commit message"
            className="h-20 w-full resize-none bg-transparent px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
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
          <div
            role="group"
            aria-label="Commit actions"
            className="flex h-10 items-center justify-between gap-2 border-t border-border px-2 py-1"
          >
            <div className="flex min-w-0 items-center gap-3 text-xs text-zinc-300">
              <button
                type="button"
                onClick={() => {
                  void handleGenerateCommitMessage();
                }}
                disabled={isBusy || !hasStagedChanges}
                aria-label={
                  aiLoading
                    ? "Generating commit message"
                    : "Generate commit message"
                }
                aria-busy={aiLoading}
                className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded border border-border bg-zinc-800 text-zinc-100 transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
                title={
                  aiLoading
                    ? "Generating commit message"
                    : "Generate commit message with AI"
                }
              >
                {aiLoading ? (
                  <span
                    aria-hidden="true"
                    className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-500/40 border-t-zinc-100"
                  />
                ) : (
                  <IconSparkles size={14} aria-hidden="true" />
                )}
              </button>
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
            <div className="relative inline-flex h-8 flex-shrink-0 items-center gap-2">
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
      </div>
      {error ? <div className="mt-1 text-xs text-red-400">{error}</div> : null}
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
