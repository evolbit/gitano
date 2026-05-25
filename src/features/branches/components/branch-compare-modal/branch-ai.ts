import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
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
import { isAiSetupRequiredMessage } from "@/shared/utils/ai-setup-errors";
import type {
  ExternalAiRunEvent,
  LocalAiActionKind,
  LocalAiRunProgress,
  LocalAiRunResult,
} from "@/shared/api/local-ai";

export type BranchAiAction = "analysis" | "review";

export type BranchAiState = {
  result: LocalAiRunResult | null;
  loading: boolean;
  error: string | null;
  progressRunId: string | null;
  progress: LocalAiRunProgress[];
  externalEvents: ExternalAiRunEvent[];
};

export type BranchAiSetupState = {
  actionKind: LocalAiActionKind;
  reason: string;
};

type BranchAiStateSetter = Dispatch<SetStateAction<BranchAiState>>;
type BranchAiRunEvent = Pick<
  LocalAiRunProgress | ExternalAiRunEvent,
  "actionKind" | "runId"
>;
type BranchAiRunListener<TEvent extends BranchAiRunEvent> = (
  handler: (event: TEvent) => void,
) => Promise<() => void> | (() => void);
type NotifyAiError = (
  title: string,
  analysisError: unknown,
  expanded?: boolean,
) => void;

export const emptyBranchAiState = (): BranchAiState => ({
  result: null,
  loading: false,
  error: null,
  progressRunId: null,
  progress: [],
  externalEvents: [],
});

export function createBranchAiRunId(action: BranchAiAction) {
  return `branch-${action}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function branchAiActionKind(
  action: BranchAiAction,
): LocalAiActionKind {
  return action === "analysis" ? "branchAnalysis" : "branchReview";
}

function branchAiActionForKind(
  actionKind: LocalAiActionKind,
): BranchAiAction | null {
  if (actionKind === "branchAnalysis") return "analysis";
  if (actionKind === "branchReview") return "review";
  return null;
}

export function describeAiError(error: unknown) {
  return error instanceof Error ? error.message : String(error || "");
}

export function shouldOpenAiSetup(errorMessage: string) {
  return isAiSetupRequiredMessage(errorMessage);
}

export function branchAiFailureTitle(action: BranchAiAction) {
  const actionLabel = action === "review" ? "review" : "analysis";
  return `AI ${actionLabel} failed`;
}

export function branchAiSetter(
  action: BranchAiAction,
  setBranchAnalysis: BranchAiStateSetter,
  setBranchReview: BranchAiStateSetter,
) {
  return action === "analysis" ? setBranchAnalysis : setBranchReview;
}

export function useBranchAiRunEvents<TEvent extends BranchAiRunEvent>({
  activeRunIdsRef,
  listen,
  updateState,
  appendEvent,
}: {
  activeRunIdsRef: MutableRefObject<Record<BranchAiAction, string | null>>;
  listen: BranchAiRunListener<TEvent>;
  updateState: (
    action: BranchAiAction,
    updater: SetStateAction<BranchAiState>,
  ) => void;
  appendEvent: (current: BranchAiState, event: TEvent) => BranchAiState;
}) {
  useEffect(() => {
    const unlistenPromise = listen((event) => {
      const action = branchAiActionForKind(event.actionKind);
      if (!action || event.runId !== activeRunIdsRef.current[action]) {
        return;
      }

      updateState(action, (current) => appendEvent(current, event));
    });

    return () => {
      void Promise.resolve(unlistenPromise)
        .then((unlisten) => unlisten())
        .catch(() => undefined);
    };
  }, [activeRunIdsRef, appendEvent, listen, updateState]);
}

export function useBranchAiRunner({
  comparisonMode,
  comparisonReady,
  notifyAiError,
  onReviewReset,
  repoPath,
  sourceBranch,
  targetBranch,
}: {
  comparisonMode: string;
  comparisonReady: boolean;
  notifyAiError: NotifyAiError;
  onReviewReset: () => void;
  repoPath: string;
  sourceBranch: string | null;
  targetBranch: string | null;
}) {
  const [branchAnalysis, setBranchAnalysis] = useState<BranchAiState>(
    emptyBranchAiState,
  );
  const [branchReview, setBranchReview] = useState<BranchAiState>(
    emptyBranchAiState,
  );
  const [branchAiSetup, setBranchAiSetup] =
    useState<BranchAiSetupState | null>(null);
  const activeRunIdsRef = useRef<Record<BranchAiAction, string | null>>({
    analysis: null,
    review: null,
  });
  const updateBranchAiState = useCallback(
    (action: BranchAiAction, updater: SetStateAction<BranchAiState>) => {
      branchAiSetter(action, setBranchAnalysis, setBranchReview)(updater);
    },
    [],
  );

  useBranchAiRunEvents({
    activeRunIdsRef,
    listen: listenToLocalAiRunProgress,
    updateState: updateBranchAiState,
    appendEvent: appendLocalAiRunProgress,
  });

  useBranchAiRunEvents({
    activeRunIdsRef,
    listen: listenToExternalAiRunEvents,
    updateState: updateBranchAiState,
    appendEvent: appendExternalAiRunEvent,
  });

  const resetBranchAiAction = useCallback(
    (action: BranchAiAction) => {
      activeRunIdsRef.current[action] = null;
      branchAiSetter(action, setBranchAnalysis, setBranchReview)(
        emptyBranchAiState(),
      );
      if (action === "review") {
        onReviewReset();
      }
    },
    [onReviewReset],
  );

  const resetBranchAiRuns = useCallback(() => {
    activeRunIdsRef.current = {
      analysis: null,
      review: null,
    };
    setBranchAnalysis(emptyBranchAiState());
    setBranchReview(emptyBranchAiState());
    onReviewReset();
  }, [onReviewReset]);

  const runBranchAiAction = useCallback(
    async (action: BranchAiAction, forceRefresh = false) => {
      if (!comparisonReady || !sourceBranch || !targetBranch) return;

      const actionKind = branchAiActionKind(action);
      const runId = createBranchAiRunId(action);
      activeRunIdsRef.current[action] = runId;
      const setState = branchAiSetter(
        action,
        setBranchAnalysis,
        setBranchReview,
      );
      setState({
        result: null,
        loading: true,
        error: null,
        progressRunId: runId,
        progress: [],
        externalEvents: [],
      });
      if (action === "review") {
        onReviewReset();
      }

      try {
        const result = await runLocalAiAction({
          repoPath,
          actionKind,
          runId,
          baseRef: targetBranch,
          headRef: sourceBranch,
          comparisonMode,
          forceRefresh,
        });
        if (activeRunIdsRef.current[action] !== runId) return;
        setState((current) =>
          current.progressRunId === runId
            ? {
                ...current,
                result,
                loading: false,
                error: null,
                progressRunId: runId,
              }
            : current,
        );
      } catch (analysisError) {
        if (activeRunIdsRef.current[action] !== runId) return;
        const errorMessage = describeAiError(analysisError);
        console.error("Branch local AI action failed", {
          actionKind,
          error: analysisError,
        });
        const opensSetup = shouldOpenAiSetup(errorMessage);
        notifyAiError(
          opensSetup
            ? "Local AI setup required"
            : branchAiFailureTitle(action),
          analysisError,
          true,
        );
        if (opensSetup) {
          setBranchAiSetup({
            actionKind,
            reason: errorMessage,
          });
        }
        setState((current) =>
          current.progressRunId === runId
            ? {
                ...current,
                result: null,
                loading: false,
                error: opensSetup ? null : errorMessage,
                progressRunId: runId,
              }
            : current,
        );
      }
    },
    [
      comparisonMode,
      comparisonReady,
      notifyAiError,
      onReviewReset,
      repoPath,
      sourceBranch,
      targetBranch,
    ],
  );

  const closeBranchAiSetup = useCallback(() => {
    setBranchAiSetup(null);
  }, []);

  const retryBranchAiSetup = useCallback(() => {
    const action =
      branchAiSetup?.actionKind === "branchReview" ? "review" : "analysis";
    setBranchAiSetup(null);
    void runBranchAiAction(action);
  }, [branchAiSetup?.actionKind, runBranchAiAction]);

  return {
    branchAiSetup,
    branchAnalysis,
    branchReview,
    closeBranchAiSetup,
    resetBranchAiAction,
    resetBranchAiRuns,
    retryBranchAiSetup,
    runBranchAiAction,
  };
}
