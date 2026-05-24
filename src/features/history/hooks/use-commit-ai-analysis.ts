import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  appendExternalAiRunEvent,
  appendLocalAiRunProgress,
} from "@/features/local-ai";
import {
  listenToExternalAiRunEvents,
  listenToLocalAiRunProgress,
  runLocalAiAction,
} from "@/shared/api/local-ai";
import type { CommitListItem } from "@/shared/types/git";
import type { CommitAiAnalysisState } from "../types/commit-list";
import { createCommitAiRunId } from "../components/commit-list/utils";

type UseCommitAiAnalysisParams = {
  repoPath?: string | null;
  notifyError: (title: string, actionError: unknown) => void;
};

export function shouldOpenCommitAiSetup(analysisError: unknown) {
  const message =
    analysisError instanceof Error
      ? analysisError.message
      : String(analysisError || "");
  return (
    message.includes("LOCAL_AI_MODEL_SETUP_REQUIRED") ||
    message.toLowerCase().includes("ollama") ||
    message.toLowerCase().includes("local ai")
  );
}

export function useCommitAiAnalysis({
  repoPath,
  notifyError,
}: UseCommitAiAnalysisParams) {
  const [commitAiAnalysis, setCommitAiAnalysis] =
    useState<CommitAiAnalysisState | null>(null);
  const activeCommitAiRunIdRef = useRef<string | null>(null);

  useEffect(() => {
    const unlistenPromise = listenToLocalAiRunProgress((progress) => {
      if (
        progress.actionKind !== "commitAnalysis" ||
        progress.runId !== activeCommitAiRunIdRef.current
      ) {
        return;
      }

      setCommitAiAnalysis((current) =>
        current ? appendLocalAiRunProgress(current, progress) : current,
      );
    });

    return () => {
      void Promise.resolve(unlistenPromise)
        .then((unlisten) => unlisten())
        .catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    const unlistenPromise = listenToExternalAiRunEvents((event) => {
      if (
        event.actionKind !== "commitAnalysis" ||
        event.runId !== activeCommitAiRunIdRef.current
      ) {
        return;
      }

      setCommitAiAnalysis((current) =>
        current ? appendExternalAiRunEvent(current, event) : current,
      );
    });

    return () => {
      void Promise.resolve(unlistenPromise)
        .then((unlisten) => unlisten())
        .catch(() => undefined);
    };
  }, []);

  const runCommitAiAnalysis = useCallback(
    async (commit: CommitListItem, forceRefresh = false) => {
      if (!repoPath) return;

      const runId = createCommitAiRunId();
      activeCommitAiRunIdRef.current = runId;
      setCommitAiAnalysis({
        commit,
        result: null,
        loading: true,
        error: null,
        setupOpen: false,
        progressRunId: runId,
        progress: [],
        externalEvents: [],
      });

      try {
        const result = await runLocalAiAction({
          repoPath,
          actionKind: "commitAnalysis",
          runId,
          commitSha: commit.sha,
          forceRefresh,
        });
        if (activeCommitAiRunIdRef.current !== runId) {
          return;
        }
        setCommitAiAnalysis((current) =>
          current && current.progressRunId === runId
            ? {
                ...current,
                result,
                loading: false,
                error: null,
                setupOpen: false,
                progressRunId: runId,
              }
            : current,
        );
      } catch (analysisError) {
        if (activeCommitAiRunIdRef.current !== runId) {
          return;
        }
        const openSetup = shouldOpenCommitAiSetup(analysisError);
        if (!openSetup) {
          notifyError("Local AI analysis failed", analysisError);
        }
        setCommitAiAnalysis((current) =>
          current && current.progressRunId === runId
            ? {
                ...current,
                result: null,
                loading: false,
                error: null,
                setupOpen: openSetup,
                progressRunId: runId,
              }
            : {
                commit,
                result: null,
                loading: false,
                error: null,
                setupOpen: openSetup,
                progressRunId: runId,
                progress: [],
                externalEvents: [],
              },
        );
      }
    },
    [notifyError, repoPath],
  );

  const closeCommitAiAnalysis = useCallback(() => {
    activeCommitAiRunIdRef.current = null;
    setCommitAiAnalysis(null);
  }, []);

  const closeCommitAiSetup = useCallback(() => {
    setCommitAiAnalysis((current) =>
      current ? { ...current, setupOpen: false } : current,
    );
  }, []);

  return {
    closeCommitAiAnalysis,
    closeCommitAiSetup,
    commitAiAnalysis,
    runCommitAiAnalysis,
  };
}
